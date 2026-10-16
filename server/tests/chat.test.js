const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const request = require('supertest');
const { io: ioClient } = require('socket.io-client');
const app = require('../src/app');
const db = require('../src/config/db');
const { initSocketServer, closeSocketServer } = require('../src/sockets/socketServer');
const authRoutes = require('../src/modules/auth/auth.routes');

describe('Real-Time Coordination & Socket.IO Chat (Phase 7)', () => {
  let httpServer;
  let serverUrl;

  let custodianCookie, custodianCsrf, custodianId;
  let borrowerCookie, borrowerCsrf, borrowerId;
  let outsiderCookie, outsiderCsrf, outsiderId;

  let libraryId;
  let bookId;
  let borrowRequestId;

  const ts = Date.now();

  async function registerUser(nameSuffix, emailPrefix) {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Bypass-Rate-Limit', '1')
      .send({
        email: `${emailPrefix}_${ts}@example.com`,
        password: 'Password123!',
        full_name: `Chat Test ${nameSuffix}`,
        phone: `+9198765${String(ts).slice(-5)}`,
        society_locality: 'Chat Test Society',
        flat_house_number: `Flat-${nameSuffix}`,
        city: 'ChatCity',
      });

    return {
      cookie: res.headers['set-cookie'].find((c) => c.startsWith('booksbuddy_sid=')).split(';')[0],
      csrf: res.body.csrfToken,
      id: res.body.user.id,
    };
  }

  async function approveJoin(userId, cookie, csrf) {
    const joinRes = await request(app)
      .post(`/api/v1/libraries/${libraryId}/join`)
      .set('Cookie', [cookie])
      .set('X-CSRF-Token', csrf)
      .send();
    const membershipId = joinRes.body.membership.id;
    await request(app)
      .put(`/api/v1/libraries/${libraryId}/members/${membershipId}`)
      .set('Cookie', [custodianCookie])
      .set('X-CSRF-Token', custodianCsrf)
      .send({ status: 'APPROVED' });
  }

  before(async () => {
    if (authRoutes.authLimiter?.reset) authRoutes.authLimiter.reset();

    // 1. Create and bind HTTP test server with Socket.IO
    httpServer = http.createServer(app);
    initSocketServer(httpServer);
    await new Promise((resolve) => httpServer.listen(0, resolve));
    const port = httpServer.address().port;
    serverUrl = `http://localhost:${port}`;

    // 2. Register users: custodian (donor/librarian), borrower, and outsider
    const cust = await registerUser('Custodian', 'chat_cust');
    custodianCookie = cust.cookie;
    custodianCsrf = cust.csrf;
    custodianId = cust.id;

    const borr = await registerUser('Borrower', 'chat_borr');
    borrowerCookie = borr.cookie;
    borrowerCsrf = borr.csrf;
    borrowerId = borr.id;

    const out = await registerUser('Outsider', 'chat_out');
    outsiderCookie = out.cookie;
    outsiderCsrf = out.csrf;
    outsiderId = out.id;

    // 3. Create Library
    const libRes = await request(app)
      .post('/api/v1/libraries')
      .set('Cookie', [custodianCookie])
      .set('X-CSRF-Token', custodianCsrf)
      .send({
        name: `Chat Test Library ${ts}`,
        society_locality: 'Chat Test Society',
        city: 'ChatCity',
      });
    libraryId = libRes.body.library.id;

    // 4. Approve borrower membership
    await approveJoin(borrowerId, borrowerCookie, borrowerCsrf);

    // 5. Custodian donates a book
    const bookRes = await request(app)
      .post('/api/v1/books')
      .set('Cookie', [custodianCookie])
      .set('X-CSRF-Token', custodianCsrf)
      .send({
        library_id: libraryId,
        title: 'Real-Time Systems and Messaging',
        author: 'Socket Pioneer',
        initial_condition: 'GOOD',
      });
    bookId = bookRes.body.book.id;

    // 6. Borrower creates a borrow request
    const reqRes = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [borrowerCookie])
      .set('X-CSRF-Token', borrowerCsrf)
      .send({ book_id: bookId });
    borrowRequestId = reqRes.body.request.id;
  });

  after(async () => {
    // Teardown sockets and HTTP server
    try {
      await closeSocketServer();
      await new Promise((resolve) => httpServer.close(resolve));
    } catch (e) {
      console.warn('[SERVER TEARDOWN WARNING]', e.message);
    }

    // Teardown DB rows
    try {
      const userIdsRes = await db.query(
        `SELECT id FROM users WHERE email LIKE 'chat_%_${ts}@example.com';`
      );
      const userIds = userIdsRes.rows.map((r) => r.id);
      if (userIds.length > 0) {
        await db.query('DELETE FROM chat_messages WHERE sender_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM custody_history WHERE to_user_id = ANY($1) OR from_user_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM handover_sessions WHERE giver_user_id = ANY($1) OR receiver_user_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM borrow_requests WHERE borrower_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM books WHERE original_donor_id = ANY($1) OR current_custodian_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM library_members WHERE user_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM libraries WHERE created_by = ANY($1);', [userIds]);
        await db.query('DELETE FROM sessions WHERE user_id = ANY($1);', [userIds]);
        await db.query('DELETE FROM users WHERE id = ANY($1);', [userIds]);
      }
    } catch (err) {
      console.warn('[DB CLEANUP WARNING]', err.message);
    }
    if (authRoutes.authLimiter?.reset) authRoutes.authLimiter.reset();
  });

  // ─── WebSocket Authentication Handshake ─────────────────

  test('Socket connection without session cookie is rejected (401)', async () => {
    let connectError = null;
    const client = ioClient(serverUrl, {
      transports: ['websocket'],
      reconnection: false,
    });

    await new Promise((resolve) => {
      client.on('connect_error', (err) => {
        connectError = err;
        resolve();
      });
      client.on('connect', () => {
        resolve();
      });
    });

    client.disconnect();
    assert.ok(connectError, 'Socket should fail to connect without cookie');
    assert.ok(
      connectError.message.includes('Authentication required') ||
      connectError.data?.statusCode === 401
    );
  });

  test('Socket connection with forged/invalid session ID is rejected', async () => {
    let connectError = null;
    const client = ioClient(serverUrl, {
      extraHeaders: {
        Cookie: 'booksbuddy_sid=forged_invalid_session_id_1234567890',
      },
      transports: ['websocket'],
      reconnection: false,
    });

    await new Promise((resolve) => {
      client.on('connect_error', (err) => {
        connectError = err;
        resolve();
      });
      client.on('connect', () => {
        resolve();
      });
    });

    client.disconnect();
    assert.ok(connectError, 'Socket should fail with forged session ID');
    assert.ok(
      connectError.message.includes('Authentication failed') ||
      connectError.data?.statusCode === 401
    );
  });

  test('Socket connection with valid session cookie succeeds', async () => {
    const client = ioClient(serverUrl, {
      extraHeaders: {
        Cookie: borrowerCookie,
      },
      transports: ['websocket'],
      reconnection: false,
    });

    const isConnected = await new Promise((resolve) => {
      client.on('connect', () => resolve(true));
      client.on('connect_error', () => resolve(false));
    });

    client.disconnect();
    assert.equal(isConnected, true, 'Socket should connect with valid session cookie');
  });

  // ─── Room Authorization ─────────────────────────────────

  test('Socket join_room fails for unauthorized outsider', async () => {
    const client = ioClient(serverUrl, {
      extraHeaders: { Cookie: outsiderCookie },
      transports: ['websocket'],
      reconnection: false,
    });

    await new Promise((resolve) => client.on('connect', resolve));

    const ack = await new Promise((resolve) => {
      client.emit('join_room', { borrowRequestId }, (response) => {
        resolve(response);
      });
    });

    client.disconnect();
    assert.equal(ack.ok, false);
    assert.ok(ack.error.includes('not authorized'));
  });

  test('Socket join_room succeeds for authorized borrower and custodian', async () => {
    const clientBorrower = ioClient(serverUrl, {
      extraHeaders: { Cookie: borrowerCookie },
      transports: ['websocket'],
      reconnection: false,
    });
    const clientCustodian = ioClient(serverUrl, {
      extraHeaders: { Cookie: custodianCookie },
      transports: ['websocket'],
      reconnection: false,
    });

    await Promise.all([
      new Promise((res) => clientBorrower.on('connect', res)),
      new Promise((res) => clientCustodian.on('connect', res)),
    ]);

    const [ackBorrower, ackCustodian] = await Promise.all([
      new Promise((res) => clientBorrower.emit('join_room', { borrowRequestId }, res)),
      new Promise((res) => clientCustodian.emit('join_room', { borrowRequestId }, res)),
    ]);

    assert.equal(ackBorrower.ok, true);
    assert.equal(ackBorrower.room, `request:${borrowRequestId}`);

    assert.equal(ackCustodian.ok, true);
    assert.equal(ackCustodian.room, `request:${borrowRequestId}`);

    clientBorrower.disconnect();
    clientCustodian.disconnect();
  });

  // ─── Real-Time Message Exchange & Persistence ───────────

  test('Real-time message exchange: borrower sends message, custodian receives it', async () => {
    const clientBorrower = ioClient(serverUrl, {
      extraHeaders: { Cookie: borrowerCookie },
      transports: ['websocket'],
      reconnection: false,
    });
    const clientCustodian = ioClient(serverUrl, {
      extraHeaders: { Cookie: custodianCookie },
      transports: ['websocket'],
      reconnection: false,
    });

    await Promise.all([
      new Promise((res) => clientBorrower.on('connect', res)),
      new Promise((res) => clientCustodian.on('connect', res)),
    ]);

    // Both join room
    await Promise.all([
      new Promise((res) => clientBorrower.emit('join_room', { borrowRequestId }, res)),
      new Promise((res) => clientCustodian.emit('join_room', { borrowRequestId }, res)),
    ]);

    // Set up message listener on custodian socket
    const messagePromise = new Promise((resolve) => {
      clientCustodian.on('receive_message', (msg) => {
        resolve(msg);
      });
    });

    // Borrower sends message
    const sendAck = await new Promise((resolve) => {
      clientBorrower.emit(
        'send_message',
        {
          borrowRequestId,
          messageText: 'Hi! Can I pick up the book around 6 PM today?',
        },
        resolve
      );
    });

    assert.equal(sendAck.ok, true);
    assert.equal(sendAck.message.messageText, 'Hi! Can I pick up the book around 6 PM today?');

    const received = await messagePromise;
    assert.equal(received.borrowRequestId, Number(borrowRequestId));
    assert.equal(received.senderId, Number(borrowerId));
    assert.equal(received.messageText, 'Hi! Can I pick up the book around 6 PM today?');
    assert.ok(received.senderName);
    assert.ok(received.createdAt);

    // Verify message persistence in PostgreSQL
    const dbMsgRes = await db.query(
      'SELECT * FROM chat_messages WHERE id = $1;',
      [received.id]
    );
    assert.equal(dbMsgRes.rowCount, 1);
    assert.equal(dbMsgRes.rows[0].message_text, 'Hi! Can I pick up the book around 6 PM today?');
    assert.equal(dbMsgRes.rows[0].sender_id, borrowerId);

    clientBorrower.disconnect();
    clientCustodian.disconnect();
  });

  test('send_message rejects empty or whitespace-only messages', async () => {
    const client = ioClient(serverUrl, {
      extraHeaders: { Cookie: borrowerCookie },
      transports: ['websocket'],
      reconnection: false,
    });

    await new Promise((res) => client.on('connect', res));
    await new Promise((res) => client.emit('join_room', { borrowRequestId }, res));

    const ack = await new Promise((res) => {
      client.emit(
        'send_message',
        {
          borrowRequestId,
          messageText: '   ',
        },
        res
      );
    });

    client.disconnect();
    assert.equal(ack.ok, false);
    assert.ok(ack.error.includes('empty'));
  });

  // ─── REST Chat History API ──────────────────────────────

  test('GET /api/v1/chat/requests/:id/messages returns 401 when not authenticated', async () => {
    const res = await request(app).get(`/api/v1/chat/requests/${borrowRequestId}/messages`);
    assert.equal(res.status, 401);
  });

  test('GET /api/v1/chat/requests/:id/messages returns 403 for unauthorized outsider', async () => {
    const res = await request(app)
      .get(`/api/v1/chat/requests/${borrowRequestId}/messages`)
      .set('Cookie', [outsiderCookie]);
    assert.equal(res.status, 403);
  });

  test('GET /api/v1/chat/requests/:id/messages returns paginated history and protects privacy', async () => {
    const res = await request(app)
      .get(`/api/v1/chat/requests/${borrowRequestId}/messages`)
      .set('Cookie', [custodianCookie]);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.messages));
    assert.ok(res.body.messages.length >= 1);
    assert.ok(res.body.pagination);
    assert.equal(res.body.pagination.page, 1);

    // Verify address privacy: flat_house_number and phone are NEVER returned
    for (const msg of res.body.messages) {
      assert.equal(msg.flat_house_number, undefined);
      assert.equal(msg.phone, undefined);
      assert.ok(msg.senderName);
      assert.ok(msg.messageText);
    }
  });

  // ─── REST Send Message Endpoint ─────────────────────────

  test('POST /api/v1/chat/requests/:id/messages sends message and broadcasts via Socket.IO', async () => {
    const clientCustodian = ioClient(serverUrl, {
      extraHeaders: { Cookie: custodianCookie },
      transports: ['websocket'],
      reconnection: false,
    });

    await new Promise((res) => clientCustodian.on('connect', res));
    await new Promise((res) => clientCustodian.emit('join_room', { borrowRequestId }, res));

    // Listen for broadcast
    const broadcastPromise = new Promise((resolve) => {
      clientCustodian.on('receive_message', (msg) => {
        resolve(msg);
      });
    });

    // Send via REST API as borrower
    const res = await request(app)
      .post(`/api/v1/chat/requests/${borrowRequestId}/messages`)
      .set('Cookie', [borrowerCookie])
      .set('X-CSRF-Token', borrowerCsrf)
      .send({ message_text: 'Sure, 6 PM works great for pickup.' });

    assert.equal(res.status, 201);
    assert.equal(res.body.chatMessage.messageText, 'Sure, 6 PM works great for pickup.');

    const broadcastMsg = await broadcastPromise;
    assert.equal(broadcastMsg.messageText, 'Sure, 6 PM works great for pickup.');

    clientCustodian.disconnect();
  });

  // ─── Real-Time Handover Status Event ─────────────────────

  test('Handover status changed event is broadcast to chat room when custodian approves', async () => {
    const clientBorrower = ioClient(serverUrl, {
      extraHeaders: { Cookie: borrowerCookie },
      transports: ['websocket'],
      reconnection: false,
    });

    await new Promise((res) => clientBorrower.on('connect', res));
    await new Promise((res) => clientBorrower.emit('join_room', { borrowRequestId }, res));

    // Set up status listener
    const statusPromise = new Promise((resolve) => {
      clientBorrower.on('handover_status_changed', (evt) => {
        resolve(evt);
      });
    });

    // Custodian approves the borrow request via REST
    const approveRes = await request(app)
      .post(`/api/v1/borrowing/requests/${borrowRequestId}/approve`)
      .set('Cookie', [custodianCookie])
      .set('X-CSRF-Token', custodianCsrf)
      .send();

    assert.equal(approveRes.status, 200);

    const statusEvent = await statusPromise;
    assert.equal(statusEvent.eventType, 'HANDOVER_PENDING');
    assert.equal(statusEvent.borrowRequestId, Number(borrowRequestId));
    assert.ok(statusEvent.timestamp);

    clientBorrower.disconnect();
  });

  // ─── Terminal State Closes Chat ─────────────────────────

  test('Sending message fails when borrow request reaches a terminal state (DECLINED)', async () => {
    // Create another book and request, then decline it
    const bRes = await request(app)
      .post('/api/v1/books')
      .set('Cookie', [custodianCookie])
      .set('X-CSRF-Token', custodianCsrf)
      .send({
        library_id: libraryId,
        title: 'Closed Book',
        author: 'Terminal Author',
        initial_condition: 'GOOD',
      });
    const tempBookId = bRes.body.book.id;

    const rRes = await request(app)
      .post('/api/v1/borrowing/requests')
      .set('Cookie', [borrowerCookie])
      .set('X-CSRF-Token', borrowerCsrf)
      .send({ book_id: tempBookId });
    const tempRequestId = rRes.body.request.id;

    // Decline request
    await request(app)
      .post(`/api/v1/borrowing/requests/${tempRequestId}/decline`)
      .set('Cookie', [custodianCookie])
      .set('X-CSRF-Token', custodianCsrf)
      .send();

    // Try sending message via REST
    const postRes = await request(app)
      .post(`/api/v1/chat/requests/${tempRequestId}/messages`)
      .set('Cookie', [borrowerCookie])
      .set('X-CSRF-Token', borrowerCsrf)
      .send({ message_text: 'Are you still there?' });

    assert.equal(postRes.status, 400);
    assert.ok(postRes.body.error.message.includes('Chat is closed'));
  });
});
