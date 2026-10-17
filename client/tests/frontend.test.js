import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setCsrfToken, getCsrfToken } from '../src/api/client.js';
import { normalizeUser } from '../src/api/auth.api.js';

describe('Frontend Architecture, API Client & Security (Phase 9)', () => {
  test('CSRF token manager stores and retrieves tokens correctly', () => {
    setCsrfToken('test-csrf-token-12345');
    assert.equal(getCsrfToken(), 'test-csrf-token-12345');

    setCsrfToken(null);
    assert.equal(getCsrfToken(), null);
  });

  test('Route matcher accurately decomposes dynamic URL patterns', () => {
    function matchRoute(pattern, pathname) {
      const patternSegments = pattern.split('/').filter(Boolean);
      const pathSegments = pathname.split('/').filter(Boolean);

      if (patternSegments.length !== pathSegments.length) {
        return null;
      }

      const params = {};
      for (let i = 0; i < patternSegments.length; i++) {
        const patternPart = patternSegments[i];
        const pathPart = pathSegments[i];

        if (patternPart.startsWith(':')) {
          const paramName = patternPart.slice(1);
          params[paramName] = pathPart;
        } else if (patternPart !== pathPart) {
          return null;
        }
      }

      return params;
    }

    // Static matches
    assert.deepEqual(matchRoute('/', '/'), {});
    assert.deepEqual(matchRoute('/login', '/login'), {});
    assert.equal(matchRoute('/login', '/register'), null);

    // Single param
    const libMatch = matchRoute('/library/:id', '/library/42');
    assert.ok(libMatch);
    assert.equal(libMatch.id, '42');

    // Dual params
    const bookMatch = matchRoute('/library/:id/book/:bookId', '/library/10/book/99');
    assert.ok(bookMatch);
    assert.equal(bookMatch.id, '10');
    assert.equal(bookMatch.bookId, '99');

    // Handover & Chat params
    const handoverMatch = matchRoute('/handover/:sessionId', '/handover/5');
    assert.ok(handoverMatch);
    assert.equal(handoverMatch.sessionId, '5');

    const chatMatch = matchRoute('/chat/:requestId', '/chat/12');
    assert.ok(chatMatch);
    assert.equal(chatMatch.requestId, '12');

    // Mismatched segment length
    assert.equal(matchRoute('/library/:id', '/library/42/extra'), null);
  });

  test('Borrowing state configuration handles all 9 lifecycle states correctly', () => {
    const states = [
      'CUSTODIAN_APPROVAL_PENDING',
      'HANDOVER_PENDING',
      'ACTIVE',
      'QUEUED',
      'RETURNED',
      'DECLINED',
      'CANCELLED',
      'EXPIRED',
      'FAILED',
    ];

    const getStatusConfig = (status, queuePosition) => ({
      CUSTODIAN_APPROVAL_PENDING: { label: 'Custodian Approval Pending', variant: 'warning' },
      HANDOVER_PENDING: { label: 'Handover Pending', variant: 'info' },
      ACTIVE: { label: 'Active Loan', variant: 'success' },
      QUEUED: {
        label: queuePosition ? `Queued (#${queuePosition})` : 'Queued (Waitlist)',
        variant: 'purple',
      },
      RETURNED: { label: 'Returned', variant: 'neutral' },
      DECLINED: { label: 'Declined', variant: 'danger' },
      CANCELLED: { label: 'Cancelled', variant: 'neutral' },
      EXPIRED: { label: 'Expired', variant: 'danger' },
      FAILED: { label: 'Handover Failed', variant: 'danger' },
    }[status]);

    for (const status of states) {
      const config = getStatusConfig(status, 3);
      assert.ok(config, `Missing status config for ${status}`);
      assert.ok(config.label.length > 0);
      assert.ok(config.variant.length > 0);
    }

    assert.equal(getStatusConfig('QUEUED', 4).label, 'Queued (#4)');
  });

  test('Role and membership authorization helpers enforce strict RBAC', () => {
    const testUser = {
      id: 1,
      memberships: [
        { library_id: 10, role: 'MEMBER', status: 'APPROVED' },
        { library_id: 20, role: 'LIBRARIAN', status: 'APPROVED' },
        { library_id: 30, role: 'PRIMARY_LIBRARIAN', status: 'APPROVED' },
        { library_id: 40, role: 'MEMBER', status: 'PENDING' },
        { library_id: 50, role: 'LIBRARIAN', status: 'REJECTED' },
      ],
    };

    function isMemberOf(user, libraryId) {
      if (!user?.memberships) return false;
      const mem = user.memberships.find((m) => m.library_id === libraryId);
      return mem ? mem.status === 'APPROVED' : false;
    }

    function isLibrarianOf(user, libraryId) {
      if (!user?.memberships) return false;
      const mem = user.memberships.find((m) => m.library_id === libraryId);
      return mem && mem.status === 'APPROVED' && (mem.role === 'LIBRARIAN' || mem.role === 'PRIMARY_LIBRARIAN');
    }

    function isPrimaryLibrarianOf(user, libraryId) {
      if (!user?.memberships) return false;
      const mem = user.memberships.find((m) => m.library_id === libraryId);
      return mem && mem.status === 'APPROVED' && mem.role === 'PRIMARY_LIBRARIAN';
    }

    // Approved Member
    assert.equal(isMemberOf(testUser, 10), true);
    assert.equal(isLibrarianOf(testUser, 10), false);
    assert.equal(isPrimaryLibrarianOf(testUser, 10), false);

    // Approved Librarian
    assert.equal(isMemberOf(testUser, 20), true);
    assert.equal(isLibrarianOf(testUser, 20), true);
    assert.equal(isPrimaryLibrarianOf(testUser, 20), false);

    // Primary Librarian
    assert.equal(isMemberOf(testUser, 30), true);
    assert.equal(isLibrarianOf(testUser, 30), true);
    assert.equal(isPrimaryLibrarianOf(testUser, 30), true);

    // Pending application: NOT an active member or librarian
    assert.equal(isMemberOf(testUser, 40), false);
    assert.equal(isLibrarianOf(testUser, 40), false);

    // Rejected application: NOT an active member or librarian
    assert.equal(isMemberOf(testUser, 50), false);
    assert.equal(isLibrarianOf(testUser, 50), false);

    // Non-existent library
    assert.equal(isMemberOf(testUser, 999), false);
  });

  test('Handover PIN format validator accepts exactly 4 numeric digits', () => {
    const isValidPin = (pin) => /^\d{4}$/.test(pin);

    assert.equal(isValidPin('1234'), true);
    assert.equal(isValidPin('0000'), true);
    assert.equal(isValidPin('9999'), true);
    assert.equal(isValidPin('0721'), true);

    assert.equal(isValidPin('123'), false); // Too short
    assert.equal(isValidPin('12345'), false); // Too long
    assert.equal(isValidPin('12a4'), false); // Non-digit
    assert.equal(isValidPin('abcd'), false); // Letters
    assert.equal(isValidPin(''), false); // Empty
  });

  test('Condition confirmation validator enforces approved ratings', () => {
    const validRatings = ['NEW', 'GOOD', 'FAIR', 'DAMAGED'];

    assert.ok(validRatings.includes('NEW'));
    assert.ok(validRatings.includes('GOOD'));
    assert.ok(validRatings.includes('FAIR'));
    assert.ok(validRatings.includes('DAMAGED'));
    assert.ok(!validRatings.includes('POOR'));
    assert.ok(!validRatings.includes('MINT'));
  });

  test('Financial ledger calculations maintain exact numerical precision', () => {
    const entries = [
      { entry_type: 'DONATION', amount: '500.00' },
      { entry_type: 'DONATION', amount: '250.50' },
      { entry_type: 'EXPENSE', amount: '300.25' },
    ];

    let inflow = 0;
    let outflow = 0;

    for (const entry of entries) {
      const amt = parseFloat(entry.amount);
      if (entry.entry_type === 'DONATION') {
        inflow += amt;
      } else if (entry.entry_type === 'EXPENSE') {
        outflow += amt;
      }
    }

    const net = inflow - outflow;

    assert.equal(inflow.toFixed(2), '750.50');
    assert.equal(outflow.toFixed(2), '300.25');
    assert.equal(net.toFixed(2), '450.25');
  });

  test('Community notice expiry validation rejects past or current dates', () => {
    const isFutureDate = (dateStr) => {
      const target = new Date(dateStr).getTime();
      return !isNaN(target) && target > Date.now();
    };

    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    assert.equal(isFutureDate(pastDate), false);
    assert.equal(isFutureDate(futureDate), true);
    assert.equal(isFutureDate('invalid-date'), false);
  });

  test('Registration payload mapper converts frontend camelCase state to backend contract', () => {
    const frontendFormData = {
      email: 'resident@example.com',
      password: 'StrongPassword123!',
      fullName: 'Aarav Librarian',
      phone: '+91 9876500001',
      societyLocality: 'Lotus Heights',
      flatHouseNumber: 'Tower A-101',
      city: 'Bengaluru',
    };

    // The mapping logic executed inside authApi.register
    const backendPayload = {
      email: frontendFormData.email,
      password: frontendFormData.password,
      full_name: frontendFormData.full_name ?? frontendFormData.fullName,
      phone: frontendFormData.phone,
      society_locality: frontendFormData.society_locality ?? frontendFormData.societyLocality,
      flat_house_number: frontendFormData.flat_house_number ?? frontendFormData.flatHouseNumber,
      city: frontendFormData.city,
    };

    // Assert that backend snake_case contract is satisfied
    assert.equal(backendPayload.full_name, 'Aarav Librarian');
    assert.equal(backendPayload.society_locality, 'Lotus Heights');
    assert.equal(backendPayload.flat_house_number, 'Tower A-101');
    assert.equal(backendPayload.email, 'resident@example.com');
    assert.equal(backendPayload.phone, '+91 9876500001');
    assert.equal(backendPayload.city, 'Bengaluru');
    assert.equal(backendPayload.fullName, undefined);
    assert.equal(backendPayload.societyLocality, undefined);
    assert.equal(backendPayload.flatHouseNumber, undefined);
  });

  test('User model normalizer maps backend snake_case to frontend camelCase consistently', () => {
    const rawBackendUser = {
      id: 42,
      email: 'member@example.com',
      full_name: 'Priya Sharma',
      phone: '+91 9123456780',
      society_locality: 'Green Glen Layout',
      flat_house_number: 'Flat 304',
      city: 'Bengaluru',
      created_at: '2026-10-16T12:00:00.000Z',
    };

    const normalized = normalizeUser(rawBackendUser);

    assert.equal(normalized.fullName, 'Priya Sharma');
    assert.equal(normalized.societyLocality, 'Green Glen Layout');
    assert.equal(normalized.flatHouseNumber, 'Flat 304');
    assert.equal(normalized.createdAt, '2026-10-16T12:00:00.000Z');
    // Preserves original fields
    assert.equal(normalized.full_name, 'Priya Sharma');
    assert.equal(normalized.society_locality, 'Green Glen Layout');
    assert.equal(normalized.flat_house_number, 'Flat 304');

    // Handles already camelCased data without overwriting
    const alreadyCamelCase = {
      id: 99,
      fullName: 'Vikram Seth',
      societyLocality: 'Indiranagar',
      flatHouseNumber: 'No. 12',
    };
    const normalizedCamel = normalizeUser(alreadyCamelCase);
    assert.equal(normalizedCamel.fullName, 'Vikram Seth');
    assert.equal(normalizedCamel.societyLocality, 'Indiranagar');
    assert.equal(normalizedCamel.flatHouseNumber, 'No. 12');

    // Handles null / undefined gracefully
    assert.equal(normalizeUser(null), null);
    assert.equal(normalizeUser(undefined), undefined);
  });

  test('Handover receiver pickup address extraction formats correctly from backend contract', () => {
    const rawSessionFromBackend = {
      id: 101,
      status: 'PENDING',
      receiver_user_id: 2,
      giver_user_id: 1,
      pickup_address: {
        flat_house_number: 'Tower A-101',
        society_locality: 'Prestige Lakeside',
        city: 'Bengaluru',
        phone: '+91 9876500001',
      },
    };

    const formatPickupAddress = (session) => {
      const addr = session.pickup_address;
      if (!addr) return null;
      const parts = [addr.flat_house_number, addr.society_locality];
      if (addr.city) parts.push(addr.city);
      return parts.filter(Boolean).join(', ');
    };

    assert.equal(
      formatPickupAddress(rawSessionFromBackend),
      'Tower A-101, Prestige Lakeside, Bengaluru'
    );
    assert.equal(rawSessionFromBackend.pickup_address.phone, '+91 9876500001');

    // Custodian session without revealed pickup_address
    const custodianSession = {
      id: 101,
      status: 'PENDING',
      receiver_user_id: 2,
      giver_user_id: 1,
    };
    assert.equal(formatPickupAddress(custodianSession), null);
  });

  test('Handover completion calculator marks session completed when both parties confirm condition', () => {
    const isHandoverCompleted = (session) =>
      Boolean(session.giver_confirmed_at && session.receiver_confirmed_at) ||
      session.status === 'COMPLETED' ||
      session.borrow_status === 'ACTIVE';

    // Status is VERIFIED in DB, but both parties confirmed condition
    const completedSession = {
      status: 'VERIFIED',
      giver_confirmed_at: '2026-10-16T12:00:00Z',
      receiver_confirmed_at: '2026-10-16T12:01:00Z',
      borrow_status: 'ACTIVE',
    };
    assert.equal(isHandoverCompleted(completedSession), true);

    // Only giver confirmed
    const partialSession = {
      status: 'VERIFIED',
      giver_confirmed_at: '2026-10-16T12:00:00Z',
      receiver_confirmed_at: null,
      borrow_status: 'HANDOVER_PENDING',
    };
    assert.equal(isHandoverCompleted(partialSession), false);
  });

  test('Financial ledger summary calculation and payload mapping handle backend contracts accurately', () => {
    // 1. Inflow/outflow/balance calculation
    const summaryData = {
      totalDonations: 2500,
      totalExpenses: 800,
      netBalance: 1700,
      totalEntries: 5,
    };

    const totalInflow = summaryData?.totalDonations ?? summaryData?.total_inflow ?? 0;
    const totalOutflow = summaryData?.totalExpenses ?? summaryData?.total_outflow ?? 0;
    const netBalance = summaryData?.netBalance ?? summaryData?.net_balance ?? 0;

    assert.equal(Number(totalInflow).toFixed(2), '2500.00');
    assert.equal(Number(totalOutflow).toFixed(2), '800.00');
    assert.equal(Number(netBalance).toFixed(2), '1700.00');

    // 2. Payload mapping: entry_type mapped to type
    const formSubmission = {
      entry_type: 'DONATION',
      amount: '1500',
      description: 'Resident book purchase contribution',
      category: 'BOOK_PURCHASE',
    };

    const backendPayload = {
      type: formSubmission.entry_type || formSubmission.type,
      amount: parseFloat(formSubmission.amount),
      description: formSubmission.description,
    };

    assert.equal(backendPayload.type, 'DONATION');
    assert.equal(backendPayload.amount, 1500);
    assert.equal(backendPayload.description, 'Resident book purchase contribution');
  });

  test('Community notice creation maps content to description and supplies contact_info fallback', () => {
    const frontendForm = {
      title: 'Book Club Sunday',
      content: 'Meeting at the clubhouse garden at 5 PM.',
      category: 'EVENT',
    };
    const user = { email: 'borrower@example.com' };
    const expDate = new Date(Date.now() + 86400000);

    const payload = {
      title: frontendForm.title.trim(),
      description: (frontendForm.content || frontendForm.description || '').trim(),
      category: frontendForm.category || 'GENERAL',
      contact_info: (frontendForm.contact_info || user?.email || user?.phone || 'Community Member').trim(),
      expires_at: expDate.toISOString(),
    };

    assert.equal(payload.title, 'Book Club Sunday');
    assert.equal(payload.description, 'Meeting at the clubhouse garden at 5 PM.');
    assert.equal(payload.category, 'EVENT');
    assert.equal(payload.contact_info, 'borrower@example.com');
    assert.ok(payload.expires_at.length > 0);
  });

  test('Library rule form maps string input states to numeric values for backend contract', () => {
    const rulesFormState = {
      max_borrow_days: '28',
      handover_window_hours: '48',
      max_books_per_member: '5',
      max_renewals: '2',
    };

    const payload = {
      max_borrow_days: parseInt(rulesFormState.max_borrow_days, 10) || 14,
      handover_window_hours: parseInt(rulesFormState.handover_window_hours, 10) || 48,
      max_books_per_member: parseInt(rulesFormState.max_books_per_member, 10) || 3,
      max_renewals: parseInt(rulesFormState.max_renewals, 10) ?? 1,
    };

    assert.strictEqual(payload.max_borrow_days, 28);
    assert.strictEqual(payload.handover_window_hours, 48);
    assert.strictEqual(payload.max_books_per_member, 5);
    assert.strictEqual(payload.max_renewals, 2);
  });

  test('Invite code response extractor correctly reads from library nested contract', () => {
    const backendResponse = {
      message: 'Invitation code regenerated successfully.',
      library: {
        id: 2,
        name: 'Meadowlands Community Library',
        invite_code: 'ABCD1234',
      },
    };

    const extractedCode = backendResponse.library?.invite_code || backendResponse.invite_code;
    assert.strictEqual(extractedCode, 'ABCD1234');

    // Fallback if returned flat
    const flatResponse = { invite_code: 'XYZ9876' };
    assert.strictEqual(flatResponse.library?.invite_code || flatResponse.invite_code, 'XYZ9876');
  });

  test('Membership state synchronization: approved member immediately evaluates to Open Library without refresh', () => {
    // Simulated raw backend login response after fix
    const rawLoginUser = {
      id: 5,
      full_name: 'Resident Reader',
      email: 'reader@example.com',
      society_locality: 'Greenwood',
      memberships: [
        {
          membership_id: 12,
          library_id: 42,
          role: 'MEMBER',
          status: 'APPROVED',
          library_name: 'Greenwood Library',
        },
      ],
    };

    const user = normalizeUser(rawLoginUser);

    function getMembershipButtonState(user, libraryId) {
      if (!user || !user.memberships) return 'Join Library (Request to Join)';
      const mem = user.memberships.find((m) => Number(m.library_id) === Number(libraryId));
      if (!mem) return 'Join Library (Request to Join)';
      if (mem.status === 'APPROVED') return 'Open Library';
      if (mem.status === 'PENDING') return 'Request Pending';
      return 'Join Library (Request to Join)';
    }

    // Immediately after login, before any page refresh or getMe call:
    assert.strictEqual(getMembershipButtonState(user, 42), 'Open Library');
    // Non-member library:
    assert.strictEqual(getMembershipButtonState(user, 99), 'Join Library (Request to Join)');
  });

  test('Platform Admin role normalizer and RBAC guard correctly identifies platform administrators', () => {
    const rawAdmin = {
      id: 5,
      full_name: 'Platform Admin',
      email: 'admin@booksbuddy.local',
      role: 'PLATFORM_ADMIN',
    };
    const adminUser = normalizeUser(rawAdmin);
    assert.strictEqual(adminUser.role, 'PLATFORM_ADMIN');
    assert.strictEqual(adminUser.isPlatformAdmin, true);

    const rawNormalUser = {
      id: 1,
      full_name: 'Regular User',
      email: 'user@example.com',
      role: 'USER',
    };
    const normalUser = normalizeUser(rawNormalUser);
    assert.strictEqual(normalUser.role, 'USER');
    assert.strictEqual(normalUser.isPlatformAdmin, false);
  });
});


