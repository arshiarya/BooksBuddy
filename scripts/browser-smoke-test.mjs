/**
 * BooksBuddy Phase 9 Comprehensive Browser Smoke Test
 * Automates real Chrome browser testing through Puppeteer across all 25 user journeys.
 */

import http from 'http';
import { spawn, execSync } from 'child_process';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('../client/node_modules/puppeteer-core');

function killProcessTree(proc) {
  if (!proc || !proc.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-proc.pid, 'SIGKILL');
    }
  } catch (e) {
    // Ignore error if process already exited
  }
}

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BACKEND_URL = 'http://localhost:5000';
const FRONTEND_URL = 'http://localhost:5173';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clickButtonByText(page, text) {
  await page.waitForFunction(
    (t) => Array.from(document.querySelectorAll('button')).some((b) => b.innerText.includes(t)),
    { timeout: 10000 },
    text
  );
  const clicked = await page.evaluate((t) => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes(t));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }, text);
  if (!clicked) throw new Error(`Could not click button containing "${text}"`);
}

async function pingUrl(url, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200 || res.status === 304) {
        return true;
      }
    } catch (e) {
      // Server not ready yet
    }
    await wait(500);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function runSmokeTests() {
  console.log('=====================================================');
  console.log('   BooksBuddy Phase 9 Browser Smoke Test Runner      ');
  console.log('=====================================================');

  let serverProc = null;
  let clientProc = null;
  let browser = null;
  const passedJourneys = [];

  try {
    // 1. Check if backend is already running, else spawn it
    let backendReady = false;
    try {
      await pingUrl(`${BACKEND_URL}/health`, 2000);
      backendReady = true;
      console.log('✔ Backend already running on port 5000');
    } catch {
      console.log('Starting backend server on port 5000...');
      serverProc = spawn('node', ['src/server.js'], {
        cwd: path.resolve('server'),
        stdio: 'pipe',
        env: { ...process.env, PORT: '5000' },
      });
      serverProc.stdout.on('data', (d) => process.stdout.write(`[SERVER] ${d}`));
      serverProc.stderr.on('data', (d) => process.stderr.write(`[SERVER ERR] ${d}`));
      await pingUrl(`${BACKEND_URL}/health`, 25000);
      console.log('✔ Backend started successfully.');
    }

    // 2. Check if frontend dev server is running, else spawn it
    let frontendReady = false;
    try {
      await pingUrl(FRONTEND_URL, 2000);
      frontendReady = true;
      console.log('✔ Frontend dev server already running on port 5173');
    } catch {
      console.log('Starting frontend Vite server on port 5173...');
      clientProc = spawn('npm', ['run', 'dev'], {
        cwd: path.resolve('client'),
        stdio: 'pipe',
        shell: true,
      });
      clientProc.stdout.on('data', (d) => process.stdout.write(`[CLIENT] ${d}`));
      clientProc.stderr.on('data', (d) => process.stderr.write(`[CLIENT ERR] ${d}`));
      await pingUrl(FRONTEND_URL, 25000);
      console.log('✔ Frontend server started successfully.');
    }

    // 3. Launch Chrome via puppeteer-core
    console.log('\nLaunching Chrome headless browser...');
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
      defaultViewport: { width: 1280, height: 800 },
    });
    console.log('✔ Chrome launched.');

    // We use two separate browser contexts to represent two distinct users simultaneously:
    // Context A: User A (Founder, Primary Librarian, Book Custodian)
    // Context B: User B (Neighbor, Borrower, Member)
    const contextA = await browser.createBrowserContext();
    const pageA = await contextA.newPage();

    const contextB = await browser.createBrowserContext();
    const pageB = await contextB.newPage();

    // Catch page errors
    pageA.on('pageerror', (err) => console.error('[PAGE A ERROR]', err.message));
    pageB.on('pageerror', (err) => console.error('[PAGE B ERROR]', err.message));

    const timestamp = Date.now();
    const userAEmail = `aarav_lib_${timestamp}@example.com`;
    const userBEmail = `bhavna_borrow_${timestamp}@example.com`;
    const password = 'StrongPassword123!';

    const recordPassed = (num, name) => {
      console.log(`\n✔ Journey ${num} PASSED: ${name}`);
      passedJourneys.push({ num, name });
    };

    // ─── Journey 1: Register User A ───────────────────────────
    console.log('\n[TEST 1] Registering User A (Librarian)...');
    await pageA.goto(`${FRONTEND_URL}/register`, { waitUntil: 'networkidle0' });
    await pageA.waitForSelector('input[placeholder="e.g. Maya Sharma"]');

    await pageA.type('input[placeholder="e.g. Maya Sharma"]', 'Aarav Librarian');
    await pageA.type('input[placeholder="name@example.com"]', userAEmail);
    await pageA.type('input[placeholder="••••••••"]', password);
    await pageA.type('input[placeholder="+91 9876543210"]', '+91 9876500001');
    await pageA.type('input[placeholder="e.g. Palm Meadows"]', 'Lotus Heights');
    await pageA.type('input[placeholder="e.g. Tower B-402"]', 'Tower A-101');
    await pageA.type('input[placeholder="e.g. Bengaluru"]', 'Bengaluru');

    await pageA.click('button[type="submit"]');
    await pageA.waitForFunction(
      () => document.querySelector('header')?.innerText.includes('Aarav Librarian'),
      { timeout: 10000 }
    );

    const navTextA = await pageA.$eval('header', (el) => el.innerText);
    if (!navTextA.includes('Aarav Librarian')) {
      throw new Error('User A was not registered/logged in properly.');
    }
    recordPassed(1, 'Register (User A)');

    // ─── Journey 2: Login / Logout ───────────────────────────
    console.log('\n[TEST 2] Testing Logout and Login for User A...');
    // Click Logout
    const logoutBtn = await pageA.waitForSelector('button[title="Sign out"]');
    await logoutBtn.click();
    await wait(800);

    let headerAfterLogout = await pageA.$eval('header', (el) => el.innerText);
    if (!headerAfterLogout.includes('Sign In')) {
      throw new Error('User A was not logged out properly.');
    }

    // Login back
    await pageA.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle0' });
    await pageA.type('input[placeholder="name@example.com"]', userAEmail);
    await pageA.type('input[placeholder="••••••••"]', password);
    await Promise.all([
      pageA.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}),
      pageA.click('button[type="submit"]'),
    ]);
    await wait(1000);

    const headerAfterLogin = await pageA.$eval('header', (el) => el.innerText);
    if (!headerAfterLogin.includes('Aarav Librarian')) {
      throw new Error('User A was not logged in properly.');
    }
    recordPassed(2, 'Login/logout');

    // ─── Journey 3: Library Discovery / Search ────────────────
    console.log('\n[TEST 3] Testing Library Discovery and Search...');
    await pageA.goto(`${FRONTEND_URL}/`, { waitUntil: 'networkidle0' });
    const searchInput = await pageA.waitForSelector('input[placeholder*="Search by library name"]');
    await searchInput.type('NonExistentNeighborhood12345');
    await pageA.keyboard.press('Enter');
    await wait(1000);

    const emptySearchText = await pageA.$eval('main', (el) => el.innerText);
    if (!emptySearchText.includes('No libraries found')) {
      throw new Error('Search did not properly filter empty results.');
    }

    // Clear search
    await pageA.click('input[placeholder*="Search by library name"]', { clickCount: 3 });
    await pageA.keyboard.press('Backspace');
    await pageA.keyboard.press('Enter');
    await wait(800);
    recordPassed(3, 'Library discovery/search');

    // ─── Journey 4: Create Library ───────────────────────────
    console.log('\n[TEST 4] Creating new community library...');
    await pageA.goto(`${FRONTEND_URL}/library/new`, { waitUntil: 'networkidle0' });
    await pageA.waitForSelector('input[placeholder*="Palm Meadows Community Library"]');

    const libName = `Lotus Heights Community Library ${timestamp}`;
    await pageA.type('input[placeholder*="Palm Meadows Community Library"]', libName);
    await pageA.type('textarea[placeholder*="Share a welcoming note"]', 'Hyperlocal reading library for Lotus Heights residents.');

    await Promise.all([
      pageA.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}),
      pageA.click('button[type="submit"]'),
    ]);
    await wait(1500);

    const currentUrl = pageA.url();
    const libIdMatch = currentUrl.match(/\/library\/(\d+)/);
    if (!libIdMatch) {
      throw new Error(`Failed to redirect to created library URL. Current: ${currentUrl}`);
    }
    const libraryId = libIdMatch[1];
    console.log(`✔ Created library ID: ${libraryId}`);

    const libHeader = await pageA.$eval('main', (el) => el.innerText);
    if (!libHeader.includes(libName) || !libHeader.includes('PRIMARY_LIBRARIAN')) {
      throw new Error('Created library header did not display name and PRIMARY_LIBRARIAN badge.');
    }
    recordPassed(4, 'Create library');

    // ─── Journey 5: Request Membership (User B) ──────────────
    console.log('\n[TEST 5] Registering User B and requesting membership...');
    await pageB.goto(`${FRONTEND_URL}/register`, { waitUntil: 'networkidle0' });
    await pageB.type('input[placeholder="e.g. Maya Sharma"]', 'Bhavna Borrower');
    await pageB.type('input[placeholder="name@example.com"]', userBEmail);
    await pageB.type('input[placeholder="••••••••"]', password);
    await pageB.type('input[placeholder="+91 9876543210"]', '+91 9876500002');
    await pageB.type('input[placeholder="e.g. Palm Meadows"]', 'Lotus Heights');
    await pageB.type('input[placeholder="e.g. Tower B-402"]', 'Tower B-202');
    await pageB.type('input[placeholder="e.g. Bengaluru"]', 'Bengaluru');

    await Promise.all([
      pageB.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}),
      pageB.click('button[type="submit"]'),
    ]);
    await wait(1000);

    // User B discovers library and requests to join
    await pageB.goto(`${FRONTEND_URL}/`, { waitUntil: 'networkidle0' });
    await pageB.waitForSelector('.group');
    // Find the button for this specific library
    const clickedJoin = await pageB.evaluate((name) => {
      const cards = Array.from(document.querySelectorAll('.group'));
      for (const card of cards) {
        if (card.innerText.includes(name)) {
          const btn = Array.from(card.querySelectorAll('button')).find((b) => b.innerText.includes('Request to Join'));
          if (btn) {
            btn.click();
            return true;
          }
        }
      }
      return false;
    }, libName);

    if (!clickedJoin) throw new Error('Could not find Request to Join button for library');
    await wait(600);

    // Submit join application modal
    await clickButtonByText(pageB, 'Submit Application');
    await wait(1000);

    // Verify User B sees "Awaiting Approval"
    const hasAwaiting = await pageB.evaluate((name) => {
      const cards = Array.from(document.querySelectorAll('.group'));
      for (const card of cards) {
        if (card.innerText.includes(name)) {
          return card.innerText.includes('Awaiting Approval') || card.innerText.includes('Application Pending');
        }
      }
      return false;
    }, libName);

    if (!hasAwaiting) throw new Error('User B does not show Awaiting Approval status.');
    recordPassed(5, 'Request membership');

    // ─── Journey 6: Librarian Approve Membership (User A) ────
    console.log('\n[TEST 6] Librarian approving User B membership...');
    await pageA.goto(`${FRONTEND_URL}/library/${libraryId}`, { waitUntil: 'networkidle0' });
    await clickButtonByText(pageA, 'Librarian Dashboard');
    await wait(1000);

    // Find Approve button for Bhavna Borrower
    const approvedMember = await pageA.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      for (const row of rows) {
        if (row.innerText.includes('Bhavna Borrower') && row.innerText.includes('PENDING')) {
          const approveBtn = Array.from(row.querySelectorAll('button')).find((b) => b.innerText.includes('Approve'));
          if (approveBtn) {
            approveBtn.click();
            return true;
          }
        }
      }
      return false;
    });

    if (!approvedMember) throw new Error('Could not find Approve button for pending member');
    await wait(1500);

    // Verify row now shows APPROVED
    const isApprovedNow = await pageA.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      return rows.some((r) => r.innerText.includes('Bhavna Borrower') && r.innerText.includes('APPROVED'));
    });
    if (!isApprovedNow) throw new Error('Member was not approved in members table.');
    recordPassed(6, 'Librarian approve membership');

    // ─── Journey 7: Open Library (User B) ────────────────────
    console.log('\n[TEST 7] User B opening library as approved member...');
    await pageB.goto(`${FRONTEND_URL}/library/${libraryId}`, { waitUntil: 'networkidle0' });
    await wait(1000);

    const userBPageText = await pageB.$eval('main', (el) => el.innerText);
    if (!userBPageText.includes('Member (MEMBER)')) {
      throw new Error('User B does not have Member badge after approval.');
    }
    // Verify Member sees community tabs
    if (!userBPageText.includes('Wishlist & Demands') || !userBPageText.includes('Financial Ledger')) {
      throw new Error('Member does not see community tabs.');
    }
    recordPassed(7, 'Open library');

    // ─── Journey 8: Browse / Search Catalogue ─────────────────
    console.log('\n[TEST 8] Browsing catalogue and search...');
    const searchCatInput = await pageB.waitForSelector('input[placeholder*="Search catalogue"]');
    await searchCatInput.type('NonExistentBook');
    await wait(500);

    let catText = await pageB.$eval('main', (el) => el.innerText);
    if (!catText.includes('No books match your search')) {
      throw new Error('Search filter did not display empty state.');
    }

    await pageB.click('input[placeholder*="Search catalogue"]', { clickCount: 3 });
    await pageB.keyboard.press('Backspace');
    await wait(500);
    recordPassed(8, 'Browse/search catalogue');

    // ─── Journey 9: Donate a Book (User A) ────────────────────
    console.log('\n[TEST 9] User A donating book to the library...');
    await pageA.goto(`${FRONTEND_URL}/library/${libraryId}`, { waitUntil: 'networkidle0' });
    await clickButtonByText(pageA, 'Donate a Book');
    await wait(600);

    const bookTitle = `The Pragmatic Programmer ${timestamp}`;
    await pageA.type('input[placeholder="e.g. Clean Code"]', bookTitle);
    await pageA.type('input[placeholder="e.g. Robert C. Martin"]', 'David Thomas & Andrew Hunt');
    await pageA.type('input[placeholder="Optional ISBN"]', '9780135957059');
    await pageA.type('input[placeholder="e.g. Fiction, Tech"]', 'Computer Science');
    await pageA.type('textarea[placeholder*="Brief description"]', 'Classic practical programming guide.');

    await clickButtonByText(pageA, 'Donate Book');
    await wait(1500);

    // Verify book is rendered in catalogue
    const hasBook = await pageA.evaluate((title) => {
      return document.querySelector('main').innerText.includes(title);
    }, bookTitle);
    if (!hasBook) throw new Error('Donated book not found in catalogue grid.');
    recordPassed(9, 'Donate a book');

    // ─── Journey 10: Open Book Details (User B) ───────────────
    console.log('\n[TEST 10] User B opening book details page...');
    await pageB.goto(`${FRONTEND_URL}/library/${libraryId}`, { waitUntil: 'networkidle0' });
    await wait(1000);

    // Click on the book card
    const clickedBook = await pageB.evaluate((title) => {
      const cards = Array.from(document.querySelectorAll('.group'));
      for (const card of cards) {
        if (card.innerText.includes(title)) {
          card.click();
          return true;
        }
      }
      return false;
    }, bookTitle);

    if (!clickedBook) throw new Error('Could not click book card');
    await wait(1000);

    const bookDetailUrl = pageB.url();
    const bookIdMatch = bookDetailUrl.match(/\/book\/(\d+)/);
    if (!bookIdMatch) throw new Error(`Not on book detail URL: ${bookDetailUrl}`);
    const bookId = bookIdMatch[1];
    console.log(`✔ Viewing Book ID: ${bookId}`);

    const bookDetailText = await pageB.$eval('main', (el) => el.innerText);
    // Verify address privacy: MUST NOT expose flat number 'Tower A-101' or phone
    if (bookDetailText.includes('Tower A-101') || bookDetailText.includes('9876500001')) {
      throw new Error('PRIVACY VIOLATION: Flat number or phone leaked on catalogue book detail page!');
    }
    // Verify Locality is shown
    if (!bookDetailText.includes('Lotus Heights')) {
      throw new Error('Custodian locality not displayed.');
    }
    recordPassed(10, 'Open book details (Privacy-preserving)');

    // ─── Journey 11: Request an Available Book (User B) ───────
    console.log('\n[TEST 11] User B requesting to borrow available book...');
    await clickButtonByText(pageB, 'Request to Borrow Book');
    await wait(1500);

    const requestStatusText = await pageB.$eval('main', (el) => el.innerText);
    if (!requestStatusText.includes('CUSTODIAN_APPROVAL_PENDING') && !requestStatusText.includes('Waiting for the current custodian')) {
      throw new Error('Borrow request did not transition to CUSTODIAN_APPROVAL_PENDING.');
    }
    recordPassed(11, 'Request an available book');

    // ─── Journey 12: Custodian Approval (User A) ──────────────
    console.log('\n[TEST 12] User A (custodian) approving borrow request...');
    await pageA.goto(`${FRONTEND_URL}/library/${libraryId}/book/${bookId}`, { waitUntil: 'networkidle0' });
    await wait(1000);

    await clickButtonByText(pageA, 'Approve Handover');
    await wait(1500);

    // Refresh User A and verify handover button appears
    await pageA.reload({ waitUntil: 'networkidle0' });
    await wait(1000);
    const hasHandoverBtn = await pageA.evaluate(() => {
      return document.querySelector('main').innerText.includes('Complete Handover') || document.querySelector('main').innerText.includes('Open Handover PIN');
    });
    if (!hasHandoverBtn) throw new Error('Handover button not found after approval.');
    recordPassed(12, 'Custodian approval');

    // ─── Journey 13: Handover Screen & Address Privacy Gate ───
    console.log('\n[TEST 13] Checking Handover Screen for User A and User B...');
    await pageB.goto(`${FRONTEND_URL}/my-books`, { waitUntil: 'networkidle0' });
    await wait(1000);

    await clickButtonByText(pageB, 'Verify Handover');
    await wait(1000);

    const handoverUrl = pageB.url();
    const sessionMatch = handoverUrl.match(/\/handover\/(\d+)/);
    if (!sessionMatch) throw new Error(`Not on handover screen: ${handoverUrl}`);
    const sessionId = sessionMatch[1];
    console.log(`✔ Handover Session ID: ${sessionId}`);

    // User B (Receiver) must now see the authorized pickup address!
    const receiverHandoverText = await pageB.$eval('main', (el) => el.innerText);
    if (!receiverHandoverText.includes('Tower A-101') || !receiverHandoverText.includes('+91 9876500001')) {
      throw new Error('Authorized borrower was NOT shown pickup address and contact info during active handover.');
    }

    // User A navigates to the same handover screen
    await pageA.goto(`${FRONTEND_URL}/handover/${sessionId}`, { waitUntil: 'networkidle0' });
    await wait(1000);
    const giverHandoverText = await pageA.$eval('main', (el) => el.innerText);
    if (!giverHandoverText.toUpperCase().includes('HANDOVER SECURITY PIN')) {
      console.error('[DIAGNOSTIC TEST 13 GIVER TEXT]:\n', giverHandoverText);
      throw new Error('Custodian was not shown Handover Security PIN.');
    }
    recordPassed(13, 'Handover screen (Address revealed strictly to authorized borrower)');

    // ─── Journey 14: PIN Verification ─────────────────────────
    console.log('\n[TEST 14] Verifying 4-digit PIN...');
    // Extract PIN from User A's screen
    const pin = await pageA.evaluate(() => {
      const pinBox = document.querySelector('.tracking-widest.select-all');
      return pinBox ? pinBox.innerText.trim() : null;
    });
    console.log(`✔ Custodian PIN: ${pin}`);
    if (!pin || pin.length !== 4) throw new Error(`Invalid PIN extracted: ${pin}`);

    // User B enters PIN
    const pinInput = await pageB.waitForSelector('input[placeholder="0000"]');
    await pinInput.type(pin);
    await clickButtonByText(pageB, 'Verify PIN');
    await wait(1500);

    const pinVerifiedText = await pageB.$eval('main', (el) => el.innerText);
    if (!pinVerifiedText.toUpperCase().includes('PIN VERIFIED')) {
      throw new Error('PIN verification was not acknowledged on receiver screen.');
    }
    recordPassed(14, 'PIN verification');

    // ─── Journey 15: Both-Side Condition Confirmation ─────────
    console.log('\n[TEST 15] Confirming condition on both sides...');
    // User A (giver) confirms condition
    await clickButtonByText(pageA, 'Confirm Condition');
    await wait(1500);

    // User B (receiver) confirms condition
    await clickButtonByText(pageB, 'Confirm Condition');
    await wait(2000);

    // Refresh both pages
    await pageB.reload({ waitUntil: 'networkidle0' });
    await wait(1000);
    const completionText = await pageB.$eval('main', (el) => el.innerText);
    if (!completionText.toUpperCase().includes('HANDOVER & CUSTODY TRANSFER COMPLETE') && !completionText.toUpperCase().includes('COMPLETED')) {
      console.error('[DIAGNOSTIC TEST 15 COMPLETION TEXT]:\n', completionText);
      throw new Error('Handover status did not reach COMPLETED after both condition confirmations.');
    }
    recordPassed(15, 'Both-side condition confirmation (Atomic custody transfer)');

    // ─── Journey 16: My Books Dashboard ───────────────────────
    console.log('\n[TEST 16] Checking My Books dashboard for active loan...');
    await pageB.goto(`${FRONTEND_URL}/my-books`, { waitUntil: 'networkidle0' });
    await wait(1000);

    const myBooksBText = await pageB.$eval('main', (el) => el.innerText);
    if (!myBooksBText.includes(bookTitle) || !myBooksBText.toUpperCase().includes('ACTIVE LOAN')) {
      throw new Error('Active loan was not listed on borrower My Books dashboard.');
    }
    recordPassed(16, 'My Books dashboard');

    // ─── Journey 17: Real-Time Chat Coordination ──────────────
    console.log('\n[TEST 17] Testing real-time Socket.IO chat...');
    // Find borrow request ID from the chat button
    await clickButtonByText(pageB, 'Chat');
    await wait(1000);

    const chatUrl = pageB.url();
    const reqIdMatch = chatUrl.match(/\/chat\/(\d+)/);
    if (!reqIdMatch) throw new Error(`Not on chat screen: ${chatUrl}`);
    const requestId = reqIdMatch[1];

    // User A opens same chat screen
    await pageA.goto(`${FRONTEND_URL}/chat/${requestId}`, { waitUntil: 'networkidle0' });
    await wait(1500);

    // User B sends message
    const chatInputB = await pageB.waitForSelector('input[placeholder*="Type a message"]');
    const msgText = `Hello Aarav! Handover went great. Time: ${timestamp}`;
    await chatInputB.type(msgText);
    await clickButtonByText(pageB, 'Send');
    await wait(1500);

    // Verify User A receives message
    const chatTextA = await pageA.$eval('main', (el) => el.innerText);
    if (!chatTextA.includes(msgText)) {
      throw new Error('Real-time chat message was not received by the other party.');
    }
    recordPassed(17, 'Chat between borrower/custodian (Socket.IO Real-time)');

    // ─── Journey 18: Book Demand Creation + Voting ─────────────
    console.log('\n[TEST 18] Testing book demands wishlist and voting...');
    await pageB.goto(`${FRONTEND_URL}/library/${libraryId}`, { waitUntil: 'networkidle0' });
    await wait(800);
    await clickButtonByText(pageB, 'Wishlist & Demands');
    await wait(1000);

    await clickButtonByText(pageB, 'Wish for a Book');
    await wait(600);

    const demandTitle = `Designing Data-Intensive Applications ${timestamp}`;
    await pageB.type('input[placeholder="e.g. Sapiens"]', demandTitle);
    await pageB.type('input[placeholder="e.g. Yuval Noah Harari"]', 'Martin Kleppmann');
    await pageB.type('textarea[placeholder*="Tell your neighbors"]', 'Essential book on distributed storage!');

    await clickButtonByText(pageB, 'Post Book Wish');
    await wait(1500);

    // Verify demand rendered with 1 Upvote
    let demandsText = await pageB.$eval('main', (el) => el.innerText);
    if (!demandsText.includes(demandTitle) || !demandsText.includes('1 Upvotes')) {
      throw new Error('Book demand was not created with initial upvote.');
    }

    // Toggle vote off
    await clickButtonByText(pageB, '1 Upvotes');
    await wait(1000);
    demandsText = await pageB.$eval('main', (el) => el.innerText);
    if (!demandsText.includes('0 Upvotes')) {
      throw new Error('Upvote toggle off failed.');
    }

    // Toggle vote back on
    await clickButtonByText(pageB, '0 Upvotes');
    await wait(1000);
    demandsText = await pageB.$eval('main', (el) => el.innerText);
    if (!demandsText.includes('1 Upvotes')) {
      throw new Error('Upvote toggle on failed.');
    }
    recordPassed(18, 'Book demand creation + voting');

    // ─── Journey 19: Ledger Viewing & Recording ───────────────
    console.log('\n[TEST 19] Testing transparent financial ledger...');
    await clickButtonByText(pageB, 'Financial Ledger');
    await wait(1000);

    const ledgerTextB = await pageB.$eval('main', (el) => el.innerText);
    if (!ledgerTextB.includes('Community Financial Transparency Notice') || !ledgerTextB.includes('Net Balance')) {
      throw new Error('Ledger summary or policy notice missing.');
    }

    // User A records an entry
    await pageA.goto(`${FRONTEND_URL}/library/${libraryId}`, { waitUntil: 'networkidle0' });
    await wait(800);
    await clickButtonByText(pageA, 'Financial Ledger');
    await wait(1000);

    await clickButtonByText(pageA, 'Record Entry');
    await wait(600);

    await pageA.type('input[placeholder="e.g. 500"]', '1500');
    await pageA.type('input[placeholder*="Purchased 3 copies"]', 'Resident book purchase contribution');

    await clickButtonByText(pageA, 'Record Transaction');
    await wait(1500);

    const ledgerTextA = await pageA.$eval('main', (el) => el.innerText);
    if (!ledgerTextA.includes('1500.00')) {
      throw new Error('New ledger entry amount not reflected in table.');
    }
    recordPassed(19, 'Ledger viewing');

    // ─── Journey 20: Notice Creation & Deletion ───────────────
    console.log('\n[TEST 20] Testing Community Notice board creation & deletion...');
    await clickButtonByText(pageB, 'Notice Board');
    await wait(1000);

    await clickButtonByText(pageB, 'Post Notice');
    await wait(600);

    const noticeTitle = `Book Club Sunday ${timestamp}`;
    await pageB.type('input[placeholder*="Weekend Book Swap"]', noticeTitle);
    await pageB.type('textarea[placeholder*="Write details"]', 'Meeting at the clubhouse garden at 5 PM.');

    await clickButtonByText(pageB, 'Publish Notice');
    await wait(1500);

    let noticesText = await pageB.$eval('main', (el) => el.innerText);
    if (!noticesText.includes(noticeTitle)) {
      throw new Error('Published notice not visible on board.');
    }

    // Delete notice
    pageB.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    const deleteNoticeBtn = await pageB.waitForSelector('button[title="Delete my notice"]');
    await deleteNoticeBtn.click();
    await wait(1500);

    noticesText = await pageB.$eval('main', (el) => el.innerText);
    if (noticesText.includes(noticeTitle)) {
      throw new Error('Notice was not deleted.');
    }
    recordPassed(20, 'Notice creation/deletion');

    // ─── Journey 21: Librarian Member Management ──────────────
    console.log('\n[TEST 21] Librarian member management...');
    await pageA.goto(`${FRONTEND_URL}/library/${libraryId}`, { waitUntil: 'networkidle0' });
    await wait(800);
    await clickButtonByText(pageA, 'Librarian Dashboard');
    await wait(1000);

    // Appoint User B as co-librarian
    const appointed = await pageA.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      for (const row of rows) {
        if (row.innerText.includes('Bhavna Borrower')) {
          const appointBtn = Array.from(row.querySelectorAll('button')).find((b) => b.innerText.includes('Appoint Librarian'));
          if (appointBtn) {
            appointBtn.click();
            return true;
          }
        }
      }
      return false;
    });

    if (!appointed) throw new Error('Appoint Librarian button not found');
    await wait(1500);

    const hasLibrarianRole = await pageA.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      return rows.some((r) => r.innerText.includes('Bhavna Borrower') && r.innerText.includes('LIBRARIAN'));
    });
    if (!hasLibrarianRole) throw new Error('Member was not promoted to LIBRARIAN.');
    recordPassed(21, 'Librarian member management');

    // ─── Journey 22: Librarian Rules Management ───────────────
    console.log('\n[TEST 22] Configuring dynamic library borrowing rules...');
    // Modify Max Borrow Duration from 14 to 28 days
    const borrowDaysInput = await pageA.waitForSelector('input[value="14"]');
    await borrowDaysInput.click({ clickCount: 3 });
    await pageA.keyboard.type('28');

    await clickButtonByText(pageA, 'Save Library Rules');
    await wait(1500);

    // Reload and verify 28 persists
    await pageA.reload({ waitUntil: 'networkidle0' });
    await wait(1000);
    const libPageText = await pageA.$eval('main', (el) => el.innerText);
    if (!libPageText.includes('28 days')) {
      throw new Error('Updated borrowing rule (28 days) did not persist.');
    }
    recordPassed(22, 'Librarian rules management');

    // ─── Journey 23: Invite Code Functionality ────────────────
    console.log('\n[TEST 23] Testing invite code regeneration...');
    pageA.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    const regenBtn = await pageA.waitForSelector('button[title="Regenerate invite code"]');
    await regenBtn.click();
    await wait(1500);

    const inviteCodeBox = await pageA.waitForSelector('.select-all');
    const newCode = await pageA.evaluate((el) => el.innerText, inviteCodeBox);
    console.log(`✔ New Regenerated Invite Code: ${newCode}`);
    if (!newCode || newCode.includes('••••')) {
      throw new Error('Invite code was not regenerated properly.');
    }
    recordPassed(23, 'Invite-code functionality');

    // ─── Journey 24: Responsive Mobile Layout ─────────────────
    console.log('\n[TEST 24] Testing responsive layout on mobile viewport (375x667)...');
    await pageA.setViewport({ width: 375, height: 667 });
    await pageA.goto(`${FRONTEND_URL}/`, { waitUntil: 'networkidle0' });
    await wait(800);

    // Verify mobile hamburger button is visible
    const hamburgerBtn = await pageA.waitForSelector('button[aria-label="Toggle menu"]');
    await hamburgerBtn.click();
    await wait(500);

    // Verify drawer opened with links
    const mobileDrawerText = await pageA.$eval('header', (el) => el.innerText);
    if (!mobileDrawerText.includes('My Shelf & Requests') || !mobileDrawerText.includes('Sign Out')) {
      throw new Error('Mobile drawer menu did not render properly.');
    }

    // Close hamburger
    await hamburgerBtn.click();
    await wait(500);
    recordPassed(24, 'Responsive layout on mobile-sized viewport');

    // ─── Journey 25: Logout and Protected-Route Behavior ──────
    console.log('\n[TEST 25] Testing logout and protected route barrier...');
    await pageA.setViewport({ width: 1280, height: 800 });
    // Navigate to protected route while logged in
    await pageA.goto(`${FRONTEND_URL}/my-books`, { waitUntil: 'networkidle0' });
    const logoutDesktop = await pageA.waitForSelector('button[title="Sign out"]');
    await logoutDesktop.click();
    await wait(1000);

    // Try navigating to protected route /my-books
    await pageA.goto(`${FRONTEND_URL}/my-books`, { waitUntil: 'networkidle0' });
    await wait(800);

    const protectedText = await pageA.$eval('main', (el) => el.innerText);
    if (!protectedText.includes('Authentication Required')) {
      throw new Error('Protected route barrier failed to intercept unauthenticated request.');
    }
    recordPassed(25, 'Logout and protected-route behavior');

    console.log('\n=====================================================');
    console.log(`🎉 ALL 25 USER JOURNEYS PASSED CLEANLY IN THE BROWSER!`);
    console.log('=====================================================');
    passedJourneys.forEach((j) => {
      console.log(`  ✔ Journey ${j.num}: ${j.name}`);
    });
  } catch (err) {
    console.error('\n❌ BROWSER SMOKE TEST FAILED:', err);
    console.log('\nJourneys passed prior to failure:');
    passedJourneys.forEach((j) => {
      console.log(`  ✔ Journey ${j.num}: ${j.name}`);
    });
    process.exitCode = 1;
  } finally {
    if (browser) {
      console.log('Closing Chrome...');
      try {
        await browser.close();
      } catch (e) {}
    }
    if (serverProc) {
      console.log('Stopping test backend process...');
      killProcessTree(serverProc);
    }
    if (clientProc) {
      console.log('Stopping test frontend process...');
      killProcessTree(clientProc);
    }
  }
}

runSmokeTests().then(() => {
  process.exit(process.exitCode || 0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
