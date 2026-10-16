const borrowingService = require('./borrowing.service');

/**
 * Phase 6: Borrowing, Handover & Custody Controller.
 * Thin HTTP layer delegating all logic to the service.
 */

// ─── Create Borrow Request ───────────────────────────────

async function createRequest(req, res, next) {
  try {
    const bookId = parseInt(req.body.book_id, 10);
    if (!bookId || isNaN(bookId)) {
      return res.status(400).json({
        error: { message: 'A valid book_id is required.', statusCode: 400 },
      });
    }

    const result = await borrowingService.createBorrowRequest(bookId, req.user.id);

    const responseData = {
      message:
        result.request.status === 'QUEUED'
          ? `Added to the waiting list at position ${result.position}.`
          : 'Borrow request created. Waiting for custodian approval.',
      request: result.request,
    };

    if (result.position !== null) {
      responseData.queue_position = result.position;
    }

    res.status(201).json(responseData);
  } catch (err) {
    next(err);
  }
}

// ─── Get Borrow Request ──────────────────────────────────

async function getRequest(req, res, next) {
  try {
    const requestId = parseInt(req.params.requestId, 10);
    if (!requestId || isNaN(requestId)) {
      return res.status(400).json({
        error: { message: 'Valid request ID is required.', statusCode: 400 },
      });
    }

    const result = await borrowingService.getBorrowRequest(requestId, req.user.id);
    res.status(200).json({ request: result });
  } catch (err) {
    next(err);
  }
}

// ─── List Requests for a Book ────────────────────────────

async function listRequests(req, res, next) {
  try {
    const bookId = parseInt(req.params.bookId, 10);
    if (!bookId || isNaN(bookId)) {
      return res.status(400).json({
        error: { message: 'Valid book ID is required.', statusCode: 400 },
      });
    }

    const requests = await borrowingService.listRequestsForBook(bookId, req.user.id);
    res.status(200).json({ requests });
  } catch (err) {
    next(err);
  }
}

// ─── Custodian Approve ───────────────────────────────────

async function approveRequest(req, res, next) {
  try {
    const requestId = parseInt(req.params.requestId, 10);
    if (!requestId || isNaN(requestId)) {
      return res.status(400).json({
        error: { message: 'Valid request ID is required.', statusCode: 400 },
      });
    }

    const result = await borrowingService.approveBorrowRequest(requestId, req.user.id);

    res.status(200).json({
      message: 'Borrow request approved. Handover session created.',
      borrowRequest: result.borrowRequest,
      handoverSession: result.handoverSession,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Custodian Decline ───────────────────────────────────

async function declineRequest(req, res, next) {
  try {
    const requestId = parseInt(req.params.requestId, 10);
    if (!requestId || isNaN(requestId)) {
      return res.status(400).json({
        error: { message: 'Valid request ID is required.', statusCode: 400 },
      });
    }

    const result = await borrowingService.declineBorrowRequest(requestId, req.user.id);

    res.status(200).json({
      message: 'Borrow request declined.',
      borrowRequest: result.borrowRequest,
      queueAdvancement: {
        promoted: result.queueAdvancement.promoted,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Cancel Borrow Request ───────────────────────────────

async function cancelRequest(req, res, next) {
  try {
    const requestId = parseInt(req.params.requestId, 10);
    if (!requestId || isNaN(requestId)) {
      return res.status(400).json({
        error: { message: 'Valid request ID is required.', statusCode: 400 },
      });
    }

    const result = await borrowingService.cancelBorrowRequest(requestId, req.user.id);

    res.status(200).json({
      message: 'Borrow request cancelled.',
      borrowRequest: result.borrowRequest,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Get Handover Session ────────────────────────────────

async function getHandover(req, res, next) {
  try {
    const sessionId = parseInt(req.params.sessionId, 10);
    if (!sessionId || isNaN(sessionId)) {
      return res.status(400).json({
        error: { message: 'Valid handover session ID is required.', statusCode: 400 },
      });
    }

    const result = await borrowingService.getHandoverSession(sessionId, req.user.id);
    res.status(200).json({ handoverSession: result });
  } catch (err) {
    next(err);
  }
}

// ─── Verify Handover PIN ─────────────────────────────────

async function verifyHandoverPin(req, res, next) {
  try {
    const sessionId = parseInt(req.params.sessionId, 10);
    if (!sessionId || isNaN(sessionId)) {
      return res.status(400).json({
        error: { message: 'Valid handover session ID is required.', statusCode: 400 },
      });
    }

    const { pin } = req.body || {};
    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        error: { message: 'A valid 4-digit PIN is required.', statusCode: 400 },
      });
    }

    const result = await borrowingService.verifyPin(sessionId, pin, req.user.id);
    res.status(200).json({
      message: 'PIN verified successfully.',
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Confirm Condition ───────────────────────────────────

async function confirmCondition(req, res, next) {
  try {
    const sessionId = parseInt(req.params.sessionId, 10);
    if (!sessionId || isNaN(sessionId)) {
      return res.status(400).json({
        error: { message: 'Valid handover session ID is required.', statusCode: 400 },
      });
    }

    const { condition_rating, condition_notes } = req.body || {};
    if (!condition_rating) {
      return res.status(400).json({
        error: { message: 'condition_rating is required (NEW, GOOD, FAIR, or DAMAGED).', statusCode: 400 },
      });
    }

    const result = await borrowingService.confirmCondition(
      sessionId,
      req.user.id,
      condition_rating.toUpperCase(),
      condition_notes || ''
    );

    const message = result.transferCompleted
      ? 'Condition confirmed. Custody transfer completed successfully.'
      : `Condition confirmed as ${result.role}. Awaiting the other party's confirmation.`;

    res.status(200).json({
      message,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Early Release ───────────────────────────────────────

async function earlyRelease(req, res, next) {
  try {
    const bookId = parseInt(req.params.bookId, 10);
    if (!bookId || isNaN(bookId)) {
      return res.status(400).json({
        error: { message: 'Valid book ID is required.', statusCode: 400 },
      });
    }

    const result = await borrowingService.initiateEarlyRelease(bookId, req.user.id);

    // Never leak the auto-generated PIN to the custodian who initiated early release
    const responseAdvancement = {
      promoted: result.queueAdvancement.promoted,
    };
    if (result.queueAdvancement.promoted) {
      responseAdvancement.handoverSessionId = result.queueAdvancement.handoverSessionId;
    }

    res.status(200).json({
      message: result.message,
      queueAdvancement: responseAdvancement,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createRequest,
  getRequest,
  listRequests,
  approveRequest,
  declineRequest,
  cancelRequest,
  getHandover,
  verifyHandoverPin,
  confirmCondition,
  earlyRelease,
};
