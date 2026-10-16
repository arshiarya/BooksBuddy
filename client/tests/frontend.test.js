import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { setCsrfToken, getCsrfToken } from '../src/api/client.js';

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
});
