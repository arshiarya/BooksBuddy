const db = require('../config/db');

/**
 * RBAC middleware factory for library-scoped authorization.
 */

/**
 * Requires the authenticated user to be an APPROVED member of the specified library.
 * @param {string} libraryIdParam - Route parameter name holding the library ID (default: 'id')
 */
function requireLibraryMember(libraryIdParam = 'id') {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required.',
          statusCode: 401,
        },
      });
    }

    const libraryId = req.params[libraryIdParam];
    if (!libraryId) {
      return res.status(400).json({
        error: {
          message: 'Library ID parameter missing in request.',
          statusCode: 400,
        },
      });
    }

    try {
      const result = await db.query(
        `SELECT id, library_id, user_id, role, status
         FROM library_members
         WHERE library_id = $1 AND user_id = $2 AND status = 'APPROVED';`,
        [libraryId, req.user.id]
      );

      if (result.rowCount === 0) {
        return res.status(403).json({
          error: {
            message: 'You must be an approved member of this library to perform this action.',
            statusCode: 403,
          },
        });
      }

      req.libraryMember = result.rows[0];
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Requires the authenticated user to be a LIBRARIAN or PRIMARY_LIBRARIAN of the specified library.
 * @param {string} libraryIdParam - Route parameter name holding the library ID (default: 'id')
 */
function requireLibrarian(libraryIdParam = 'id') {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required.',
          statusCode: 401,
        },
      });
    }

    const libraryId = req.params[libraryIdParam];
    if (!libraryId) {
      return res.status(400).json({
        error: {
          message: 'Library ID parameter missing in request.',
          statusCode: 400,
        },
      });
    }

    try {
      const result = await db.query(
        `SELECT id, library_id, user_id, role, status
         FROM library_members
         WHERE library_id = $1 AND user_id = $2 AND status = 'APPROVED'
           AND role IN ('PRIMARY_LIBRARIAN', 'LIBRARIAN');`,
        [libraryId, req.user.id]
      );

      if (result.rowCount === 0) {
        return res.status(403).json({
          error: {
            message: 'Librarian privileges required for this library.',
            statusCode: 403,
          },
        });
      }

      req.libraryMember = result.rows[0];
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Requires the authenticated user to be the PRIMARY_LIBRARIAN of the specified library.
 * @param {string} libraryIdParam - Route parameter name holding the library ID (default: 'id')
 */
function requirePrimaryLibrarian(libraryIdParam = 'id') {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required.',
          statusCode: 401,
        },
      });
    }

    const libraryId = req.params[libraryIdParam];
    if (!libraryId) {
      return res.status(400).json({
        error: {
          message: 'Library ID parameter missing in request.',
          statusCode: 400,
        },
      });
    }

    try {
      const result = await db.query(
        `SELECT id, library_id, user_id, role, status
         FROM library_members
         WHERE library_id = $1 AND user_id = $2 AND status = 'APPROVED'
           AND role = 'PRIMARY_LIBRARIAN';`,
        [libraryId, req.user.id]
      );

      if (result.rowCount === 0) {
        return res.status(403).json({
          error: {
            message: 'Only the primary librarian can perform this action.',
            statusCode: 403,
          },
        });
      }

      req.libraryMember = result.rows[0];
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Requires the authenticated user to hold the PLATFORM_ADMIN role.
 */
function requirePlatformAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: {
        message: 'Authentication required. Please log in to continue.',
        statusCode: 401,
      },
    });
  }

  if (req.user.role !== 'PLATFORM_ADMIN' && !req.user.isPlatformAdmin) {
    return res.status(403).json({
      error: {
        message: 'Platform administrator privileges required.',
        statusCode: 403,
      },
    });
  }

  next();
}

module.exports = {
  requireLibraryMember,
  requireLibrarian,
  requirePrimaryLibrarian,
  requirePlatformAdmin,
};
