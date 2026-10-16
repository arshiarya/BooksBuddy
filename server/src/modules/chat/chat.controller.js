const chatService = require('./chat.service');

/**
 * Controller for Handover Chat endpoints.
 */

async function getMessages(req, res, next) {
  try {
    const borrowRequestId = parseInt(req.params.borrowRequestId, 10);
    if (!borrowRequestId || isNaN(borrowRequestId)) {
      return res.status(400).json({
        error: { message: 'Valid borrowRequestId is required.', statusCode: 400 },
      });
    }

    const { page, limit } = req.query;
    const result = await chatService.getChatHistory(borrowRequestId, req.user.id, { page, limit });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function postMessage(req, res, next) {
  try {
    const borrowRequestId = parseInt(req.params.borrowRequestId, 10);
    if (!borrowRequestId || isNaN(borrowRequestId)) {
      return res.status(400).json({
        error: { message: 'Valid borrowRequestId is required.', statusCode: 400 },
      });
    }

    const { message_text } = req.body || {};
    const message = await chatService.sendChatMessage(borrowRequestId, req.user, message_text);

    res.status(201).json({
      message: 'Chat message sent successfully.',
      chatMessage: message,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMessages,
  postMessage,
};
