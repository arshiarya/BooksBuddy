const express = require('express');
const booksController = require('./books.controller');
const { requireAuth } = require('../../middlewares/authenticate');
const { verifyCsrf } = require('../../middlewares/csrf');
const db = require('../../config/db');

const router = express.Router();

/**
 * Middleware ensuring the authenticated user is a librarian for the library owning the book.
 */
async function requireBookLibrarian(req, res, next) {
  try {
    const bookId = req.params.id;
    const bookRes = await db.query('SELECT library_id FROM books WHERE id = $1;', [bookId]);
    if (bookRes.rowCount === 0) {
      return res.status(404).json({
        error: { message: 'Book not found.', statusCode: 404 },
      });
    }

    const libraryId = bookRes.rows[0].library_id;
    const memRes = await db.query(
      `SELECT role, status 
       FROM library_members 
       WHERE library_id = $1 AND user_id = $2 AND status = 'APPROVED'
         AND role IN ('PRIMARY_LIBRARIAN', 'LIBRARIAN');`,
      [libraryId, req.user.id]
    );

    if (memRes.rowCount === 0) {
      return res.status(403).json({
        error: { message: 'Librarian privileges required for this library.', statusCode: 403 },
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}

// 1. External metadata lookup via Open Library
router.get('/metadata/search', booksController.searchMetadata);

// 2. Catalogue search & details
router.get('/', booksController.search);
router.get('/:id', booksController.getById);

// 3. Donate book (Authenticated library member)
router.post('/', requireAuth, verifyCsrf, booksController.donate);

// 4. Remove book (Librarian only with mandatory reason)
router.delete('/:id', requireAuth, requireBookLibrarian, verifyCsrf, booksController.remove);

module.exports = router;
