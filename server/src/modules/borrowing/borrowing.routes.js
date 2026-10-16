const express = require('express');
const borrowingController = require('./borrowing.controller');
const { requireAuth } = require('../../middlewares/authenticate');
const { verifyCsrf } = require('../../middlewares/csrf');

const router = express.Router();

/**
 * Phase 6: Borrowing, Handover & Custody Routes.
 *
 * All routes require authentication. State-changing operations require CSRF verification.
 */

// ─── Borrow Requests ────────────────────────────────────

// List current user's borrow requests, incoming custodian actions, and custody books
router.get('/my-requests', requireAuth, borrowingController.getMyRequests);

// Create a borrow request (or join the FIFO queue)
router.post('/requests', requireAuth, verifyCsrf, borrowingController.createRequest);

// Get a specific borrow request by ID
router.get('/requests/:requestId', requireAuth, borrowingController.getRequest);

// List borrow requests for a specific book
router.get('/books/:bookId/requests', requireAuth, borrowingController.listRequests);

// Custodian approves a borrow request
router.post('/requests/:requestId/approve', requireAuth, verifyCsrf, borrowingController.approveRequest);

// Custodian declines a borrow request
router.post('/requests/:requestId/decline', requireAuth, verifyCsrf, borrowingController.declineRequest);

// Borrower cancels their own request
router.post('/requests/:requestId/cancel', requireAuth, verifyCsrf, borrowingController.cancelRequest);

// ─── Handover Sessions ──────────────────────────────────

// Get handover session details (with address privacy gate)
router.get('/handovers/:sessionId', requireAuth, borrowingController.getHandover);

// Verify the one-time handover PIN
router.post('/handovers/:sessionId/verify-pin', requireAuth, verifyCsrf, borrowingController.verifyHandoverPin);

// Confirm book condition (giver or receiver)
router.post('/handovers/:sessionId/confirm-condition', requireAuth, verifyCsrf, borrowingController.confirmCondition);

// ─── Early Release ───────────────────────────────────────

// Current custodian initiates early release for next FIFO member
router.post('/books/:bookId/early-release', requireAuth, verifyCsrf, borrowingController.earlyRelease);

module.exports = router;
