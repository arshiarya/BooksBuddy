const express = require('express');
const communityController = require('./community.controller');
const { requireAuth } = require('../../middlewares/authenticate');
const { requireLibraryMember, requireLibrarian } = require('../../middlewares/authorize');
const { verifyCsrf } = require('../../middlewares/csrf');

const router = express.Router();

// ─── 1. Book Demand Wishlist ─────────────────────────────

// List demands for a library
router.get(
  '/:libraryId/demands',
  requireAuth,
  requireLibraryMember('libraryId'),
  communityController.listDemands
);

// Submit a new book demand
router.post(
  '/:libraryId/demands',
  requireAuth,
  requireLibraryMember('libraryId'),
  verifyCsrf,
  communityController.createDemand
);

// Toggle upvote on a book demand
router.post(
  '/demands/:id/vote',
  requireAuth,
  verifyCsrf,
  communityController.toggleVote
);

// Update status of a book demand (Librarian only)
router.put(
  '/demands/:id/status',
  requireAuth,
  verifyCsrf,
  communityController.updateDemandStatus
);

// ─── 2. Financial Ledger ──────────────────────────────────

// View financial ledger and current net balance
router.get(
  '/:libraryId/ledger',
  requireAuth,
  requireLibraryMember('libraryId'),
  communityController.getLedger
);

// Record financial donation or expense (Librarian only)
router.post(
  '/:libraryId/ledger',
  requireAuth,
  requireLibrarian('libraryId'),
  verifyCsrf,
  communityController.createLedgerEntry
);

// ─── 3. Community Notices ─────────────────────────────────

// Fetch active non-expired community notices
router.get(
  '/:libraryId/notices',
  requireAuth,
  requireLibraryMember('libraryId'),
  communityController.listNotices
);

// Post a community notice
router.post(
  '/:libraryId/notices',
  requireAuth,
  requireLibraryMember('libraryId'),
  verifyCsrf,
  communityController.createNotice
);

// Remove a community notice (Author or Librarian)
router.delete(
  '/notices/:id',
  requireAuth,
  verifyCsrf,
  communityController.removeNotice
);

module.exports = router;
