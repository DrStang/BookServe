const csv = require('csv-parser');
const fs = require('fs');
const Book = require('../models/Book');

class GoodreadsImportService {
  /**
   * Parse Goodreads CSV export and extract book data
   * @param {string} filePath - Path to the CSV file
   * @returns {Promise<Array>} Array of parsed book objects
   */
  static parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const books = [];

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          // Extract relevant fields from Goodreads CSV
          const book = {
            title: row['Title'],
            author: row['Author'] || row['Author l-f'],
            additionalAuthors: row['Additional Authors'],
            isbn: row['ISBN'] || null,
            isbn13: row['ISBN13'] || null,
            publisher: row['Publisher'],
            publishedYear: row['Year Published'] || row['Original Publication Year'],
            pageCount: row['Number of Pages'] ? parseInt(row['Number of Pages']) : null,
            myRating: row['My Rating'] ? parseFloat(row['My Rating']) : null,
            averageRating: row['Average Rating'] ? parseFloat(row['Average Rating']) : null,
            dateRead: row['Date Read'],
            dateAdded: row['Date Added'],
            bookshelves: row['Bookshelves'],
            exclusiveShelf: row['Exclusive Shelf'], // read, currently-reading, to-read
            myReview: row['My Review'],
            readCount: row['Read Count'] ? parseInt(row['Read Count']) : 0,
          };

          // Clean ISBN fields (remove Goodreads' ="..." format)
          if (book.isbn) {
            book.isbn = book.isbn.replace(/^="|"$/g, '');
          }
          if (book.isbn13) {
            book.isbn13 = book.isbn13.replace(/^="|"$/g, '');
          }

          books.push(book);
        })
        .on('end', () => {
          resolve(books);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  /**
   * Match imported books against existing library
   * @param {Array} importedBooks - Books from CSV
   * @param {number} userId - User ID performing the import
   * @returns {Promise<Object>} Match results with found/missing books
   */
  static async matchBooks(importedBooks, userId) {
    const results = {
      matched: [],
      matchedToRead: [], // Matched books that are on "to-read" shelf
      notFound: [],
      notFoundToRead: [], // Not found books that are on "to-read" shelf
      errors: []
    };

    console.log(`\n=== Matching ${importedBooks.length} books for user ${userId} ===`);

    for (const importedBook of importedBooks) {
      try {
        // Try to find book by ISBN first (most accurate)
        let matchedBook = null;

        if (importedBook.isbn13) {
          console.log(`Searching by ISBN13: ${importedBook.isbn13} for "${importedBook.title}"`);
          matchedBook = await Book.findByISBN(importedBook.isbn13);
        }

        if (!matchedBook && importedBook.isbn) {
          console.log(`Searching by ISBN: ${importedBook.isbn} for "${importedBook.title}"`);
          matchedBook = await Book.findByISBN(importedBook.isbn);
        }

        // If no ISBN match, try title + author
        if (!matchedBook) {
          console.log(`Searching by title/author: "${importedBook.title}" by ${importedBook.author}`);
          matchedBook = await Book.findByTitleAndAuthor(
            importedBook.title,
            importedBook.author
          );
        }

        const isToRead = importedBook.exclusiveShelf === 'to-read';

        if (matchedBook) {
          console.log(`✓ MATCHED: "${importedBook.title}" -> Book ID ${matchedBook.id}`);

          // Save to goodreads_imports tracking table
          try {
            await this.saveImportedBook(userId, matchedBook.id, importedBook);
            console.log(`  Saved to tracking table`);
          } catch (saveError) {
            console.error(`  Error saving to tracking table:`, saveError);
          }

          results.matched.push({
            imported: importedBook,
            existing: matchedBook,
            matchType: 'found'
          });

          // Track matched to-read books separately
          if (isToRead) {
            results.matchedToRead.push({
              imported: importedBook,
              existing: matchedBook,
              matchType: 'found'
            });
          }
        } else {
          console.log(`✗ NOT FOUND: "${importedBook.title}" by ${importedBook.author} (shelf: ${importedBook.exclusiveShelf})`);
          results.notFound.push(importedBook);

          // Track not found to-read books separately
          if (isToRead) {
            results.notFoundToRead.push(importedBook);
          }
        }
      } catch (error) {
        console.error(`ERROR matching "${importedBook.title}":`, error);
        results.errors.push({
          book: importedBook,
          error: error.message
        });
      }
    }

    console.log(`\n=== Matching Summary ===`);
    console.log(`Total: ${importedBooks.length}`);
    console.log(`Matched: ${results.matched.length} (${results.matchedToRead.length} to-read)`);
    console.log(`Not Found: ${results.notFound.length} (${results.notFoundToRead.length} to-read)`);
    console.log(`Errors: ${results.errors.length}\n`);

    return results;
  }

  /**
   * Save imported book to tracking table
   * @param {number} userId - User ID
   * @param {number} bookId - Matched book ID
   * @param {Object} importedBook - Original Goodreads book data
   */
  static async saveImportedBook(userId, bookId, importedBook) {
    const { db } = require('../database/init');

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO goodreads_imports (user_id, book_id, title, author, isbn, shelf)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          bookId,
          importedBook.title,
          importedBook.author,
          importedBook.isbn13 || importedBook.isbn,
          importedBook.exclusiveShelf
        ],
        (err) => {
          if (err) {
            console.error('Error saving imported book:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Create book requests for books not in library
   * @param {Array} notFoundBooks - Books to create requests for
   * @param {number} userId - User ID creating the requests
   * @returns {Promise<Array>} Created request IDs
   */
  static async createRequests(notFoundBooks, userId) {
    const Request = require('../models/Request');
    const requests = [];

    for (const book of notFoundBooks) {
      try {
        const request = await Request.create({
          user_id: userId,
          title: book.title,
          author: book.author,
          isbn: book.isbn13 || book.isbn,
          publisher: book.publisher,
          year: book.publishedYear,
          status: 'pending',
          notes: `Imported from Goodreads${book.bookshelves ? ` (${book.bookshelves})` : ''}`
        });
        requests.push(request);

        // Automatically trigger NZBHydra search and SABnzbd download (don't await to avoid blocking)
        this.processBookRequest(request.id).catch(err => {
          console.error(`Error processing book request for ${book.title}:`, err);
        });
      } catch (error) {
        console.error(`Error creating request for ${book.title}:`, error);
      }
    }

    return requests;
  }

  /**
   * Process book request - search NZBHydra and download via SABnzbd
   * @param {number} requestId - Request ID
   */
  static async processBookRequest(requestId) {
    // Import the processBookRequest function from requestController
    // We need to access the internal processing logic
    const requestController = require('../controllers/requestController');

    // Call the internal processing function directly
    // Note: This accesses the non-exported function, so we'll need to export it
    // For now, we'll duplicate the logic here or call it via require if exported

    try {
      const BookRequest = require('../models/BookRequest');
      const request = await BookRequest.findById(requestId);

      if (!request) {
        console.error(`Request ${requestId} not found`);
        return;
      }

      console.log(`Auto-processing Goodreads import request: ${request.title} by ${request.author}`);

      // Update status to searching
      await BookRequest.updateStatus(requestId, 'searching');

      // Search NZBHydra
      const nzbResults = await this.searchNZBHydra(request.title, request.author);

      if (!nzbResults || nzbResults.length === 0) {
        await BookRequest.updateStatus(requestId, 'failed', {
          error_message: 'No books found for download. Will retry.'
        });
        // Schedule retry
        const retryIntervalDays = parseInt(process.env.RETRY_INTERVAL_DAYS) || 3;
        await BookRequest.scheduleRetry(requestId, retryIntervalDays);
        console.log(`Scheduled retry for request ${requestId} in ${retryIntervalDays} days`);
        return;
      }

      // Get the best result (first one)
      const bestResult = nzbResults[0];
      console.log(`Found book on NZBHydra: ${bestResult.title}`);

      // Send to SABnzbd
      const sabnzbdId = await this.sendToSABnzbd(bestResult);

      if (!sabnzbdId) {
        await BookRequest.updateStatus(requestId, 'failed', {
          error_message: 'Failed to add to SABnzbd'
        });
        const retryIntervalDays = parseInt(process.env.RETRY_INTERVAL_DAYS) || 3;
        await BookRequest.scheduleRetry(requestId, retryIntervalDays);
        return;
      }

      // Update request with SABnzbd ID
      await BookRequest.updateStatus(requestId, 'downloading', {
        sabnzbd_id: sabnzbdId
      });

      console.log(`Successfully queued download for: ${request.title}`);
    } catch (error) {
      console.error(`Error processing book request ${requestId}:`, error);
      const BookRequest = require('../models/BookRequest');
      await BookRequest.updateStatus(requestId, 'failed', {
        error_message: error.message
      });
    }
  }

  /**
   * Search NZBHydra for book
   */
  static async searchNZBHydra(title, author) {
    const axios = require('axios');
    const xml2js = require('xml2js');

    try {
      const nzbhydraUrl = process.env.NZBHYDRA_URL;
      const apiKey = process.env.NZBHYDRA_API_KEY;

      if (!nzbhydraUrl || !apiKey) {
        console.error('NZBHydra configuration missing');
        return null;
      }

      let searchQuery = title;
      if (author) {
        searchQuery += ` ${author}`;
      }
      searchQuery += ' epub';

      console.log(`Searching NZBHydra for: "${searchQuery}"`);

      const response = await axios.get(`${nzbhydraUrl}/api`, {
        params: {
          apikey: apiKey,
          t: 'search',
          q: searchQuery,
          cat: 7020, // eBooks
          extended: 1
        },
        timeout: 30000
      });

      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(response.data);

      if (!result.rss || !result.rss.channel || !result.rss.channel[0].item) {
        return [];
      }

      const items = result.rss.channel[0].item;
      console.log(`NZBHydra returned ${items.length} results`);

      return items.map(item => ({
        title: item.title[0],
        link: item.link[0],
        guid: item.guid ? item.guid[0]._ || item.guid[0] : null,
        size: item['newznab:attr']
          ? item['newznab:attr'].find(attr => attr.$.name === 'size')?.$?.value
          : null,
      }));
    } catch (error) {
      console.error('NZBHydra search error:', error);
      return null;
    }
  }

  /**
   * Send book to SABnzbd for download
   */
  static async sendToSABnzbd(nzbResult) {
    const axios = require('axios');

    try {
      const sabnzbdUrl = process.env.SABNZBD_URL;
      const apiKey = process.env.SABNZBD_API_KEY;

      if (!sabnzbdUrl || !apiKey) {
        console.error('SABnzbd configuration missing');
        return null;
      }

      console.log(`Sending to SABnzbd: ${nzbResult.title}`);

      const response = await axios.get(`${sabnzbdUrl}/api`, {
        params: {
          apikey: apiKey,
          mode: 'addurl',
          name: nzbResult.link,
          cat: 'books',
          priority: 0,
          output: 'json'
        },
        timeout: 10000
      });

      if (response.data.status === true && response.data.nzo_ids && response.data.nzo_ids.length > 0) {
        const sabnzbdId = response.data.nzo_ids[0];
        console.log(`Added to SABnzbd with ID: ${sabnzbdId}`);
        return sabnzbdId;
      }

      console.error('SABnzbd did not return a valid ID');
      return null;
    } catch (error) {
      console.error('SABnzbd error:', error);
      return null;
    }
  }

  /**
   * Get user's imported books from Goodreads
   * @param {number} userId - User ID
   * @param {string} shelf - Optional shelf filter (to-read, read, currently-reading)
   * @returns {Promise<Array>} Array of imported books with book details
   */
  static async getImportedBooks(userId, shelf = null) {
    const { db } = require('../database/init');

    return new Promise((resolve, reject) => {
      let query = `
        SELECT
          gi.id as import_id,
          gi.shelf,
          gi.imported_at,
          b.*
        FROM goodreads_imports gi
        INNER JOIN books b ON gi.book_id = b.id
        WHERE gi.user_id = ?
      `;

      const params = [userId];

      if (shelf) {
        query += ' AND gi.shelf = ?';
        params.push(shelf);
      }

      query += ' ORDER BY gi.imported_at DESC';

      db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Error fetching imported books:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Generate import summary report
   * @param {Object} matchResults - Results from matchBooks
   * @param {Array} createdRequests - Created request objects
   * @returns {Object} Summary statistics
   */
  static generateSummary(matchResults, createdRequests = []) {
    return {
      total: matchResults.matched.length + matchResults.notFound.length + matchResults.errors.length,
      matched: matchResults.matched.length,
      matchedToRead: matchResults.matchedToRead.length,
      notFound: matchResults.notFound.length,
      notFoundToRead: matchResults.notFoundToRead.length,
      requestsCreated: createdRequests.length,
      errors: matchResults.errors.length,
      details: {
        matchedBooks: matchResults.matched.map(m => ({
          title: m.imported.title,
          author: m.imported.author,
          existingId: m.existing.id,
          shelf: m.imported.exclusiveShelf
        })),
        matchedToReadBooks: matchResults.matchedToRead.map(m => ({
          title: m.imported.title,
          author: m.imported.author,
          existingId: m.existing.id
        })),
        notFoundBooks: matchResults.notFound.map(b => ({
          title: b.title,
          author: b.author,
          isbn: b.isbn13 || b.isbn,
          shelf: b.exclusiveShelf
        })),
        notFoundToReadBooks: matchResults.notFoundToRead.map(b => ({
          title: b.title,
          author: b.author,
          isbn: b.isbn13 || b.isbn
        })),
        errorBooks: matchResults.errors.map(e => ({
          title: e.book.title,
          error: e.error
        }))
      }
    };
  }
}

module.exports = GoodreadsImportService;
