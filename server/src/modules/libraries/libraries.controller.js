const librariesService = require('./libraries.service');

/**
 * Controller for libraries discovery and management.
 */

async function search(req, res, next) {
  try {
    const { q, locality, city, page, limit } = req.query;
    const result = await librariesService.searchLibraries({
      q,
      locality,
      city,
      page,
      limit,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const library = await librariesService.getLibraryById(
      req.params.id,
      req.user?.id || null
    );

    if (!library) {
      return res.status(404).json({
        error: {
          message: 'Library not found.',
          statusCode: 404,
        },
      });
    }

    res.status(200).json({ library });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const {
      name,
      society_locality,
      city,
      description,
      max_borrow_days,
      handover_window_hours,
      max_books_per_member,
      max_renewals,
    } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        error: {
          message: 'Library name must be at least 2 characters long.',
          statusCode: 400,
        },
      });
    }

    if (!society_locality || typeof society_locality !== 'string' || society_locality.trim().length < 2) {
      return res.status(400).json({
        error: {
          message: 'Society or locality is required.',
          statusCode: 400,
        },
      });
    }

    if (!city || typeof city !== 'string' || city.trim().length < 2) {
      return res.status(400).json({
        error: {
          message: 'City is required.',
          statusCode: 400,
        },
      });
    }

    // Rule validations: positive integers
    if (max_borrow_days !== undefined && parseInt(max_borrow_days, 10) <= 0) {
      return res.status(400).json({
        error: {
          message: 'max_borrow_days must be a positive integer.',
          statusCode: 400,
        },
      });
    }

    if (handover_window_hours !== undefined && parseInt(handover_window_hours, 10) <= 0) {
      return res.status(400).json({
        error: {
          message: 'handover_window_hours must be a positive integer.',
          statusCode: 400,
        },
      });
    }

    if (max_books_per_member !== undefined && parseInt(max_books_per_member, 10) <= 0) {
      return res.status(400).json({
        error: {
          message: 'max_books_per_member must be a positive integer.',
          statusCode: 400,
        },
      });
    }

    if (max_renewals !== undefined && parseInt(max_renewals, 10) < 0) {
      return res.status(400).json({
        error: {
          message: 'max_renewals must be 0 or a positive integer.',
          statusCode: 400,
        },
      });
    }

    const library = await librariesService.createLibrary({
      name,
      society_locality,
      city,
      description,
      max_borrow_days,
      handover_window_hours,
      max_books_per_member,
      max_renewals,
      userId: req.user.id,
    });

    res.status(201).json({
      message: 'Library created successfully.',
      library,
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { max_borrow_days, handover_window_hours, max_books_per_member, max_renewals } = req.body;

    if (max_borrow_days !== undefined && parseInt(max_borrow_days, 10) <= 0) {
      return res.status(400).json({
        error: { message: 'max_borrow_days must be a positive integer.', statusCode: 400 },
      });
    }

    if (handover_window_hours !== undefined && parseInt(handover_window_hours, 10) <= 0) {
      return res.status(400).json({
        error: { message: 'handover_window_hours must be a positive integer.', statusCode: 400 },
      });
    }

    if (max_books_per_member !== undefined && parseInt(max_books_per_member, 10) <= 0) {
      return res.status(400).json({
        error: { message: 'max_books_per_member must be a positive integer.', statusCode: 400 },
      });
    }

    if (max_renewals !== undefined && parseInt(max_renewals, 10) < 0) {
      return res.status(400).json({
        error: { message: 'max_renewals must be 0 or a positive integer.', statusCode: 400 },
      });
    }

    const updated = await librariesService.updateLibrary(req.params.id, req.body);
    res.status(200).json({
      message: 'Library rules updated successfully.',
      library: updated,
    });
  } catch (err) {
    next(err);
  }
}

async function join(req, res, next) {
  try {
    const inviteCode = req.body.invite_code || req.query.invite_code || '';
    const membership = await librariesService.joinLibrary(
      req.params.id,
      req.user.id,
      inviteCode
    );

    res.status(201).json({
      message: 'Membership request submitted successfully. Awaiting librarian approval.',
      membership,
    });
  } catch (err) {
    next(err);
  }
}

async function listMembers(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    const result = await librariesService.listMembers(req.params.id, {
      status,
      page,
      limit,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function updateMember(req, res, next) {
  try {
    const { status, role } = req.body;
    if (!status && !role) {
      return res.status(400).json({
        error: {
          message: 'At least one of status or role must be provided.',
          statusCode: 400,
        },
      });
    }

    const actingUser = {
      id: req.user.id,
      libraryRole: req.libraryMember.role,
    };

    const updatedMember = await librariesService.updateMember(
      req.params.id,
      req.params.memberId,
      { status, role },
      actingUser
    );

    res.status(200).json({
      message: 'Membership updated successfully.',
      member: updatedMember,
    });
  } catch (err) {
    next(err);
  }
}

async function regenerateInviteCode(req, res, next) {
  try {
    const updated = await librariesService.regenerateInviteCode(req.params.id);
    res.status(200).json({
      message: 'Invitation code regenerated successfully.',
      library: updated,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  search,
  getById,
  create,
  update,
  join,
  listMembers,
  updateMember,
  regenerateInviteCode,
};
