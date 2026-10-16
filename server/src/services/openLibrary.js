/**
 * Service for querying Open Library's public book metadata API.
 * Uses native fetch with timeout and error resilience.
 */

const OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json';
const OPEN_LIBRARY_TIMEOUT_MS = 6000;

/**
 * Searches Open Library by title, author, or ISBN.
 * @param {string} query 
 * @param {number} [limit=10]
 * @returns {Promise<Array<{ title: string, author: string, isbn: string|null, coverImageUrl: string|null, genre: string|null, firstPublishYear: number|null }>>}
 */
async function searchOpenLibrary(query, limit = 10) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  const trimmedQuery = query.trim();
  const cleanIsbn = trimmedQuery.replace(/[-\s]/g, '');
  const isIsbn = /^(97(8|9))?\d{9}(\d|X)$/i.test(cleanIsbn);

  const searchParams = new URLSearchParams();
  if (isIsbn) {
    searchParams.set('isbn', cleanIsbn);
  } else {
    searchParams.set('q', trimmedQuery);
  }
  searchParams.set('limit', String(limit));
  searchParams.set('fields', 'title,author_name,isbn,cover_i,subject,first_publish_year');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPEN_LIBRARY_TIMEOUT_MS);

  try {
    const url = `${OPEN_LIBRARY_SEARCH_URL}?${searchParams.toString()}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'BooksBuddy-VirtualLibrary/1.0 (Community Book Sharing Platform)',
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[OPEN LIBRARY WARNING] HTTP ${response.status} from Open Library API`);
      return [];
    }

    const data = await response.json();
    const docs = Array.isArray(data.docs) ? data.docs : [];

    return docs.map((doc) => {
      const isbn = Array.isArray(doc.isbn) && doc.isbn.length > 0 ? doc.isbn[0] : null;
      let coverImageUrl = null;

      if (doc.cover_i) {
        coverImageUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
      } else if (isbn) {
        coverImageUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
      }

      const author = Array.isArray(doc.author_name) && doc.author_name.length > 0
        ? doc.author_name.join(', ')
        : 'Unknown Author';

      const genre = Array.isArray(doc.subject) && doc.subject.length > 0
        ? doc.subject.slice(0, 3).join(', ')
        : null;

      return {
        title: doc.title || 'Untitled',
        author,
        isbn,
        coverImageUrl,
        genre,
        firstPublishYear: doc.first_publish_year || null,
      };
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.warn('[OPEN LIBRARY TIMEOUT] Request timed out after 6 seconds.');
    } else {
      console.warn('[OPEN LIBRARY ERROR] Network lookup failed:', err.message);
    }
    // Return empty list so caller can fall back to manual metadata entry
    return [];
  }
}

module.exports = {
  searchOpenLibrary,
};
