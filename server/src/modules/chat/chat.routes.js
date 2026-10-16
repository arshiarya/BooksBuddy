const express = require('express');
const chatController = require('./chat.controller');
const { requireAuth } = require('../../middlewares/authenticate');
const { verifyCsrf } = require('../../middlewares/csrf');

const router = express.Router();

// Get paginated message history for a borrow request
router.get('/requests/:borrowRequestId/messages', requireAuth, chatController.getMessages);

// Send message via REST (alternative to WebSocket, broadcasts to room)
router.post('/requests/:borrowRequestId/messages', requireAuth, verifyCsrf, chatController.postMessage);

module.exports = router;
