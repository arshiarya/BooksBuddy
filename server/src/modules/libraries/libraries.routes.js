const express = require('express');
const librariesController = require('./libraries.controller');
const { requireAuth } = require('../../middlewares/authenticate');
const { requireLibrarian } = require('../../middlewares/authorize');
const { verifyCsrf } = require('../../middlewares/csrf');

const router = express.Router();

// Public discovery
router.get('/', librariesController.search);
router.get('/:id', librariesController.getById);

// Library creation (Authenticated)
router.post('/', requireAuth, verifyCsrf, librariesController.create);

// Join library (Authenticated)
router.post('/:id/join', requireAuth, verifyCsrf, librariesController.join);

// Librarian Dashboard Management
router.put('/:id', requireAuth, requireLibrarian('id'), verifyCsrf, librariesController.update);
router.get('/:id/members', requireAuth, requireLibrarian('id'), librariesController.listMembers);
router.put('/:id/members/:memberId', requireAuth, requireLibrarian('id'), verifyCsrf, librariesController.updateMember);
router.post('/:id/invite-code', requireAuth, requireLibrarian('id'), verifyCsrf, librariesController.regenerateInviteCode);

module.exports = router;
