const metadataService = require('../services/metadataService');
const googleBooksService = require('../services/googleBooksService');
const openLibraryService = require('../services/openLibraryService');
const Book = require('../models/Book');

/**
 * Fetch metadata for a specific book
 */
exports.fetchBookMetadata = async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query;

    if (force === 'true') {
      const Book = require('../models/Book');
      await Book.update(id, { metadata_locked: 0 });
    }

    const updatedBook = await metadataService.updateBookMetadata(id, force === 'true');

    res.json({
      message: 'Metadata updated successfully',
      book: updatedBook
    });
  } catch (error) {
    console.error('Error fetching book metadata:', error);
    res.status(500).json({ error: error.message || 'Error fetching metadata' });
  }
};

/**
 * Batch update metadata for multiple books
 */
exports.batchUpdateMetadata = async (req, res) => {
  try {
    const { bookIds, force } = req.body;

    if (!bookIds || !Array.isArray(bookIds)) {
      return res.status(400).json({ error: 'bookIds array required' });
    }

    const results = await metadataService.batchUpdateMetadata(bookIds, force === true);

    res.json({
      message: 'Batch metadata update completed',
      results
    });
  } catch (error) {
    console.error('Error batch updating metadata:', error);
    res.status(500).json({ error: error.message || 'Error updating metadata' });
  }
};

/**
 * Update metadata for all books in library
 */
exports.updateAllMetadata = async (req, res) => {
  try {
    const { force } = req.query;

    // Start the update process in the background
    metadataService.updateAllMetadata(force === 'true')
      .then(results => {
        console.log('Metadata update completed:', results);
      })
      .catch(error => {
        console.error('Metadata update failed:', error);
      });

    res.json({
      message: 'Metadata update started in background',
      note: 'This may take a while. Check server logs for progress.'
    });
  } catch (error) {
    console.error('Error starting metadata update:', error);
    res.status(500).json({ error: error.message || 'Error starting update' });
  }
};

/**
 * Search Google Books
 */
exports.searchGoogleBooks = async (req, res) => {
  try {
    const { q, isbn, title, author } = req.query;

    let results;

    if (isbn) {
      const result = await googleBooksService.searchByISBN(isbn);
      results = result ? [result] : [];
    } else if (title) {
      const result = await googleBooksService.searchByTitleAuthor(title, author);
      results = result ? [result] : [];
    } else if (q) {
      results = await googleBooksService.search(q);
    } else {
      return res.status(400).json({ error: 'Query parameter required (q, isbn, or title)' });
    }

    res.json({ results, count: results.length });
  } catch (error) {
    console.error('Error searching Google Books:', error);
    res.status(500).json({ error: 'Error searching Google Books' });
  }
};

/**
 * Search OpenLibrary
 */
exports.searchOpenLibrary = async (req, res) => {
  try {
    const { q, isbn, title, author } = req.query;

    let results;

    if (isbn) {
      const result = await openLibraryService.searchByISBN(isbn);
      results = result ? [result] : [];
    } else if (title) {
      const result = await openLibraryService.searchByTitleAuthor(title, author);
      results = result ? [result] : [];
    } else if (q) {
      results = await openLibraryService.search(q);
    } else {
      return res.status(400).json({ error: 'Query parameter required (q, isbn, or title)' });
    }

    res.json({ results, count: results.length });
  } catch (error) {
    console.error('Error searching OpenLibrary:', error);
    res.status(500).json({ error: 'Error searching OpenLibrary' });
  }
};

/**
 * Get combined metadata from all sources
 */
exports.getMetadata = async (req, res) => {
  try {
    const { isbn, isbn_13, title, author } = req.query;

    if (!isbn && !isbn_13 && !title) {
      return res.status(400).json({ error: 'ISBN or title required' });
    }

    const metadata = await metadataService.fetchMetadata({
      isbn,
      isbn_13,
      title,
      author
    });

    res.json(metadata);
  } catch (error) {
    console.error('Error fetching metadata:', error);
    res.status(500).json({ error: 'Error fetching metadata' });
  }
};
