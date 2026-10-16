const { Server } = require('socket.io');
const db = require('../config/db');
const env = require('../config/env');
const { SESSION_COOKIE_NAME } = require('../middlewares/authenticate');
const { registerChatHandlers } = require('./chatHandler');

let ioInstance = null;

/**
 * Parses cookies from raw Cookie header string.
 * @param {string} cookieHeader
 * @returns {Record<string, string>}
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return cookies;
  }

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx !== -1) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  }
  return cookies;
}

/**
 * Socket.IO cookie authentication middleware.
 * Verifies the HttpOnly server-managed session cookie during the WebSocket handshake.
 */
async function socketAuthMiddleware(socket, next) {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    const cookies = parseCookies(cookieHeader);
    const sessionId = cookies[SESSION_COOKIE_NAME];

    if (!sessionId || typeof sessionId !== 'string') {
      const err = new Error('Authentication required. Missing session cookie.');
      err.data = { code: 'UNAUTHORIZED', statusCode: 401 };
      return next(err);
    }

    const query = `
      SELECT s.id AS session_id, s.user_id, s.expires_at,
             u.id, u.email, u.full_name, u.society_locality, u.city
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > CURRENT_TIMESTAMP;
    `;

    const result = await db.query(query, [sessionId]);

    if (result.rowCount === 0) {
      const err = new Error('Authentication failed. Invalid or expired session.');
      err.data = { code: 'SESSION_EXPIRED', statusCode: 401 };
      return next(err);
    }

    const row = result.rows[0];
    socket.user = {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      societyLocality: row.society_locality,
      city: row.city,
    };
    socket.sessionId = row.session_id;

    next();
  } catch (err) {
    console.error('[SOCKET AUTH ERROR]', err.message);
    const authErr = new Error('Authentication internal error.');
    authErr.data = { code: 'INTERNAL_ERROR', statusCode: 500 };
    next(authErr);
  }
}

/**
 * Initializes Socket.IO on the given HTTP server instance.
 * @param {import('http').Server} httpServer
 * @returns {Server}
 */
function initSocketServer(httpServer) {
  if (ioInstance) {
    return ioInstance;
  }

  const io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    serveClient: false,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Attach authentication middleware
  io.use(socketAuthMiddleware);

  // Connection handler
  io.on('connection', (socket) => {
    registerChatHandlers(io, socket);
  });

  ioInstance = io;
  return io;
}

/**
 * Returns the active Socket.IO server instance if initialized.
 * @returns {Server|null}
 */
function getIo() {
  return ioInstance;
}

/**
 * Broadcasts a handover status event to participants in a borrow request room.
 * @param {number|string} borrowRequestId
 * @param {string} eventType
 * @param {object} payload
 */
function broadcastHandoverStatus(borrowRequestId, eventType, payload = {}) {
  if (ioInstance) {
    const room = `request:${borrowRequestId}`;
    ioInstance.to(room).emit('handover_status_changed', {
      eventType,
      borrowRequestId: Number(borrowRequestId),
      timestamp: new Date().toISOString(),
      ...payload,
    });
  }
}

/**
 * Closes the Socket.IO instance and clears references (used in tests).
 */
async function closeSocketServer() {
  if (ioInstance) {
    await new Promise((resolve) => ioInstance.close(resolve));
    ioInstance = null;
  }
}

module.exports = {
  initSocketServer,
  getIo,
  broadcastHandoverStatus,
  closeSocketServer,
  socketAuthMiddleware,
  parseCookies,
};
