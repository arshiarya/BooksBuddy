const booksService = require('./books.service');
const { searchOpenLibrary } = require('../../services/openLibrary');

/**
 * Controller for Book Catalogue and Donations.
 */

async function searchMetadata(req, res, next) {
  try {
    const query = req.query.q || '';
    if (!query.trim()) {
      return res.status(200).json({ results: [] });
    }

    const results = await searchOpenLibrary(query, 10);
    res.status(200).json({ results });
  } catch (err) {
    next(err);
  }
}

async function search(req, res, next) {
  try {
    const { library_id, q, genre, status, page, limit } = req.query;
    const result = await booksService.searchCatalogue({
      library_id,
      q,
      genre,
      status,
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
    const book = await booksService.getBookById(req.params.id);
    if (!book) {
      return res.status(404).json({
        error: {
          message: 'Book not found in library catalogue.',
          statusCode: 404,
        },
      });
    }

    res.status(200).json({ book });
  } catch (err) {
    next(err);
  }
}

async function donate(req, res, next) {
  try {
    const body = req.body || {};
    const {
      library_id,
      title,
      author,
      isbn,
      cover_image_url,
      genre,
      description,
      initial_condition,
    } = body;

    if (!library_id) {
      return res.status(400).json({
        error: {
          message: 'Target library_id is required.',
          statusCode: 400,
        },
      });
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        error: {
          message: 'Book title is required.',
          statusCode: 400,
        },
      });
    }

    if (!author || typeof author !== 'string' || !author.trim()) {
      return res.status(400).json({
        error: {
          message: 'Book author is required.',
          statusCode: 400,
        },
      });
    }

    const result = await booksService.donateBook({
      library_id,
      title,
      author,
      isbn,
      cover_image_url,
      genre,
      description,
      initial_condition,
      donor_user_id: req.user.id,
    });

    res.status(201).json({
      message: 'Book donated successfully and added to the library catalogue.',
      book: result.book,
      initialCustody: result.initialCustody,
    });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const body = req.body || {};
    const removalReason = body.removal_reason;

    if (!removalReason || typeof removalReason !== 'string' || !removalReason.trim()) {
      return res.status(400).json({
        error: {
          message: 'A mandatory removal reason must be provided.',
          statusCode: 400,
        },
      });
    }

    const removed = await booksService.removeBook(
      req.params.id,
      removalReason,
      req.user.id
    );

    res.status(200).json({
      message: 'Book removed from catalogue successfully.',
      book: removed,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  searchMetadata,
  search,
  getById,
  donate,
  remove,
};
