const db = require('../config/db');

/**
 * Validates that a user is an authorized participant (borrower, custodian, or handover participant)
 * for the specified borrow request.
 * @param {number|string} borrowRequestId
 * @param {number|string} userId
 * @returns {Promise<{authorized: boolean, request?: object, error?: string}>}
 */
async function verifyChatAccess(borrowRequestId, userId) {
  const reqId = parseInt(borrowRequestId, 10);
  if (!reqId || isNaN(reqId)) {
    return { authorized: false, error: 'Invalid borrow request ID.' };
  }

  const query = `
    SELECT br.id, br.status, br.borrower_id,
           b.id AS book_id, b.title AS book_title, b.current_custodian_id, b.library_id
    FROM borrow_requests br
    JOIN books b ON b.id = br.book_id
    WHERE br.id = $1;
  `;

  const result = await db.query(query, [reqId]);
  if (result.rowCount === 0) {
    return { authorized: false, error: 'Borrow request not found.' };
  }

  const br = result.rows[0];

  // Direct check: borrower or current custodian of the book
  if (br.borrower_id === userId || br.current_custodian_id === userId) {
    return { authorized: true, request: br };
  }

  // Also check if user was a designated giver/receiver in the handover session
  const hsQuery = `
    SELECT id FROM handover_sessions
    WHERE borrow_request_id = $1 AND (giver_user_id = $2 OR receiver_user_id = $2);
  `;
  const hsRes = await db.query(hsQuery, [reqId, userId]);
  if (hsRes.rowCount > 0) {
    return { authorized: true, request: br };
  }

  return { authorized: false, error: 'You are not authorized to access this chat room.' };
}

/**
 * Registers real-time Socket.IO chat event handlers on a connected socket.
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerChatHandlers(io, socket) {
  const user = socket.user;

  // 1. Join Chat Room
  socket.on('join_room', async (data, callback) => {
    try {
      const borrowRequestId = data?.borrowRequestId;
      const { authorized, request, error } = await verifyChatAccess(borrowRequestId, user.id);

      if (!authorized) {
        if (typeof callback === 'function') {
          return callback({ ok: false, error: error || 'Unauthorized' });
        }
        return socket.emit('error', { message: error || 'Unauthorized' });
      }

      const room = `request:${borrowRequestId}`;
      socket.join(room);

      if (typeof callback === 'function') {
        callback({ ok: true, room, status: request.status });
      }
    } catch (err) {
      console.error('[SOCKET JOIN_ROOM ERROR]', err.message);
      if (typeof callback === 'function') {
        callback({ ok: false, error: 'Failed to join chat room.' });
      }
    }
  });

  // 2. Leave Chat Room
  socket.on('leave_room', (data, callback) => {
    const borrowRequestId = data?.borrowRequestId;
    if (borrowRequestId) {
      socket.leave(`request:${borrowRequestId}`);
    }
    if (typeof callback === 'function') {
      callback({ ok: true });
    }
  });

  // 3. Send Message
  socket.on('send_message', async (data, callback) => {
    try {
      const { borrowRequestId, messageText } = data || {};

      if (!borrowRequestId) {
        const errMsg = 'borrowRequestId is required.';
        if (typeof callback === 'function') return callback({ ok: false, error: errMsg });
        return socket.emit('error', { message: errMsg });
      }

      if (!messageText || typeof messageText !== 'string' || !messageText.trim()) {
        const errMsg = 'Message text cannot be empty.';
        if (typeof callback === 'function') return callback({ ok: false, error: errMsg });
        return socket.emit('error', { message: errMsg });
      }

      const trimmedText = messageText.trim();
      if (trimmedText.length > 1000) {
        const errMsg = 'Message text cannot exceed 1000 characters.';
        if (typeof callback === 'function') return callback({ ok: false, error: errMsg });
        return socket.emit('error', { message: errMsg });
      }

      const { authorized, request, error } = await verifyChatAccess(borrowRequestId, user.id);
      if (!authorized) {
        if (typeof callback === 'function') return callback({ ok: false, error });
        return socket.emit('error', { message: error });
      }

      // Check request state: only allow sending messages while request is active or pending handover
      const activeStates = ['CUSTODIAN_APPROVAL_PENDING', 'HANDOVER_PENDING', 'ACTIVE'];
      if (!activeStates.includes(request.status)) {
        const errMsg = `Chat is closed for this request because its status is ${request.status}.`;
        if (typeof callback === 'function') return callback({ ok: false, error: errMsg });
        return socket.emit('error', { message: errMsg });
      }

      // Persist message in PostgreSQL
      const insertQuery = `
        INSERT INTO chat_messages (borrow_request_id, sender_id, message_text)
        VALUES ($1, $2, $3)
        RETURNING id, borrow_request_id, sender_id, message_text, created_at;
      `;
      const insertRes = await db.query(insertQuery, [borrowRequestId, user.id, trimmedText]);
      const savedMsg = insertRes.rows[0];

      const payload = {
        id: savedMsg.id,
        borrowRequestId: Number(savedMsg.borrow_request_id),
        senderId: Number(savedMsg.sender_id),
        senderName: user.fullName,
        messageText: savedMsg.message_text,
        createdAt: savedMsg.created_at,
      };

      // Broadcast to room (including sender, or use callback for sender)
      const room = `request:${borrowRequestId}`;
      io.to(room).emit('receive_message', payload);

      if (typeof callback === 'function') {
        callback({ ok: true, message: payload });
      }
    } catch (err) {
      console.error('[SOCKET SEND_MESSAGE ERROR]', err.message);
      if (typeof callback === 'function') {
        callback({ ok: false, error: 'Internal server error processing message.' });
      }
    }
  });
}

module.exports = {
  verifyChatAccess,
  registerChatHandlers,
};
