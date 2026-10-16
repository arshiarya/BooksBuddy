const db = require('../../config/db');
const { verifyChatAccess } = require('../../sockets/chatHandler');
const { getIo } = require('../../sockets/socketServer');

/**
 * Retrieves paginated chat messages for a borrow request.
 * Enforces room authorization and shields sender private address/phone.
 */
async function getChatHistory(borrowRequestId, userId, { page = 1, limit = 50 } = {}) {
  const { authorized, error } = await verifyChatAccess(borrowRequestId, userId);
  if (!authorized) {
    const err = new Error(error || 'You are not authorized to view this chat history.');
    err.statusCode = 403;
    throw err;
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (safePage - 1) * safeLimit;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM chat_messages
    WHERE borrow_request_id = $1;
  `;

  // Fetch messages in chronological order, joining sender name
  // Privacy invariant: sender flat_house_number and phone are NOT queried or exposed
  const dataQuery = `
    SELECT cm.id, cm.borrow_request_id, cm.sender_id, cm.message_text, cm.created_at,
           u.full_name AS sender_name
    FROM chat_messages cm
    JOIN users u ON u.id = cm.sender_id
    WHERE cm.borrow_request_id = $1
    ORDER BY cm.created_at ASC, cm.id ASC
    LIMIT $2 OFFSET $3;
  `;

  const [countRes, dataRes] = await Promise.all([
    db.query(countQuery, [borrowRequestId]),
    db.query(dataQuery, [borrowRequestId, safeLimit, offset]),
  ]);

  const total = parseInt(countRes.rows[0]?.total || 0, 10);

  return {
    messages: dataRes.rows.map((r) => ({
      id: r.id,
      borrowRequestId: Number(r.borrow_request_id),
      senderId: Number(r.sender_id),
      senderName: r.sender_name,
      messageText: r.message_text,
      createdAt: r.created_at,
    })),
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

/**
 * Sends a chat message via REST and broadcasts it to connected WebSocket clients.
 */
async function sendChatMessage(borrowRequestId, user, messageText) {
  if (!messageText || typeof messageText !== 'string' || !messageText.trim()) {
    const err = new Error('Message text cannot be empty.');
    err.statusCode = 400;
    throw err;
  }

  const trimmedText = messageText.trim();
  if (trimmedText.length > 1000) {
    const err = new Error('Message text cannot exceed 1000 characters.');
    err.statusCode = 400;
    throw err;
  }

  const { authorized, request, error } = await verifyChatAccess(borrowRequestId, user.id);
  if (!authorized) {
    const err = new Error(error || 'Unauthorized');
    err.statusCode = 403;
    throw err;
  }

  const activeStates = ['CUSTODIAN_APPROVAL_PENDING', 'HANDOVER_PENDING', 'ACTIVE'];
  if (!activeStates.includes(request.status)) {
    const err = new Error(`Chat is closed for this request because its status is ${request.status}.`);
    err.statusCode = 400;
    throw err;
  }

  const insertQuery = `
    INSERT INTO chat_messages (borrow_request_id, sender_id, message_text)
    VALUES ($1, $2, $3)
    RETURNING id, borrow_request_id, sender_id, message_text, created_at;
  `;

  const res = await db.query(insertQuery, [borrowRequestId, user.id, trimmedText]);
  const savedMsg = res.rows[0];

  const payload = {
    id: savedMsg.id,
    borrowRequestId: Number(savedMsg.borrow_request_id),
    senderId: Number(savedMsg.sender_id),
    senderName: user.fullName || user.full_name,
    messageText: savedMsg.message_text,
    createdAt: savedMsg.created_at,
  };

  // Broadcast to connected WebSocket room if initialized
  const io = getIo();
  if (io) {
    io.to(`request:${borrowRequestId}`).emit('receive_message', payload);
  }

  return payload;
}

module.exports = {
  getChatHistory,
  sendChatMessage,
};
