const communityService = require('./community.service');

/**
 * Controller for Community Features (Demands, Ledger, Notices).
 */

// ─── 1. Book Demand Handlers ─────────────────────────────

async function listDemands(req, res, next) {
  try {
    const libraryId = parseInt(req.params.libraryId, 10);
    const { status, page, limit } = req.query;

    const result = await communityService.listDemands(libraryId, req.user.id, {
      status,
      page,
      limit,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function createDemand(req, res, next) {
  try {
    const libraryId = parseInt(req.params.libraryId, 10);
    const { title, author, isbn } = req.body || {};

    const demand = await communityService.createDemand(libraryId, req.user.id, {
      title,
      author,
      isbn,
    });

    res.status(201).json({
      message: 'Book demand submitted successfully.',
      demand,
    });
  } catch (err) {
    next(err);
  }
}

async function toggleVote(req, res, next) {
  try {
    const demandId = parseInt(req.params.id, 10);
    if (!demandId || isNaN(demandId)) {
      return res.status(400).json({
        error: { message: 'Valid demand ID is required.', statusCode: 400 },
      });
    }

    const result = await communityService.toggleDemandVote(demandId, req.user.id);

    res.status(200).json({
      message: result.hasVoted ? 'Vote added.' : 'Vote removed.',
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

async function updateDemandStatus(req, res, next) {
  try {
    const demandId = parseInt(req.params.id, 10);
    if (!demandId || isNaN(demandId)) {
      return res.status(400).json({
        error: { message: 'Valid demand ID is required.', statusCode: 400 },
      });
    }

    const { status, librarian_notes } = req.body || {};
    const updated = await communityService.updateDemandStatus(demandId, req.user.id, {
      status,
      librarian_notes,
    });

    res.status(200).json({
      message: 'Demand status updated successfully.',
      demand: updated,
    });
  } catch (err) {
    next(err);
  }
}

// ─── 2. Ledger Handlers ──────────────────────────────────

async function getLedger(req, res, next) {
  try {
    const libraryId = parseInt(req.params.libraryId, 10);
    const { page, limit } = req.query;

    const result = await communityService.getLedger(libraryId, { page, limit });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function createLedgerEntry(req, res, next) {
  try {
    const libraryId = parseInt(req.params.libraryId, 10);
    const { type, amount, description, user_id } = req.body || {};

    const entry = await communityService.createLedgerEntry(libraryId, req.user.id, {
      type,
      amount,
      description,
      user_id,
    });

    res.status(201).json({
      message: 'Financial entry recorded successfully.',
      entry,
    });
  } catch (err) {
    next(err);
  }
}

// ─── 3. Notice Handlers ──────────────────────────────────

async function listNotices(req, res, next) {
  try {
    const libraryId = parseInt(req.params.libraryId, 10);
    const { category, includeExpired } = req.query;

    const notices = await communityService.listNotices(libraryId, {
      category,
      includeExpired: includeExpired === 'true',
    });

    res.status(200).json({ notices });
  } catch (err) {
    next(err);
  }
}

async function createNotice(req, res, next) {
  try {
    const libraryId = parseInt(req.params.libraryId, 10);
    const { title, description, category, contact_info, image_url, expires_at } = req.body || {};

    const notice = await communityService.createNotice(libraryId, req.user.id, {
      title,
      description,
      category,
      contact_info,
      image_url,
      expires_at,
    });

    res.status(201).json({
      message: 'Notice posted successfully.',
      notice,
    });
  } catch (err) {
    next(err);
  }
}

async function removeNotice(req, res, next) {
  try {
    const noticeId = parseInt(req.params.id, 10);
    if (!noticeId || isNaN(noticeId)) {
      return res.status(400).json({
        error: { message: 'Valid notice ID is required.', statusCode: 400 },
      });
    }

    const removed = await communityService.removeNotice(noticeId, req.user.id);

    res.status(200).json({
      message: 'Notice removed successfully.',
      notice: removed,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listDemands,
  createDemand,
  toggleVote,
  updateDemandStatus,
  getLedger,
  createLedgerEntry,
  listNotices,
  createNotice,
  removeNotice,
};
