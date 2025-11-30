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
  * Normalize text for fuzzy matching
  */
  static normalizeText(text) {
    if(!text) return ''; 
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }
  /**
  * Calculate similarity score between two strings (0-100)
  */
  static calculateSimilarity(str1, str2) {
    const norm1 = this.normalizeText(str1);
    const norm2 = this.normalizeText(str2);

    if (norm1 === norm2) return 100;
    if (!norm1 || !norm2) return 0;

    const matrix = [];
    for (let i = 0; i <= norm2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= norm1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= norm2.length; i++) {
      for (let j = 1; j <= norm1.length; j++) {
        if (norm2.charAt(i - 1) === norm1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j -1 ] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    const distance = matrix[norm2.length][norm1.length];
    const maxLength = Math.max(norm1.length, norm2.length);
    return Math.round(((maxLength - distance) / maxLength) * 100);
  }
    /**
   * Enhanced book matching with scoring
   * @param {Object} importedBook - Book from Goodreads
   * @param {Array} libraryBooks - All books in library
   * @returns {Object|null} Best match with score
   */
  static findBestMatch(importedBook, libraryBooks) {
    let bestMatch = null;
    let bestScore = 0;
    const THRESHOLD = 70; // Minimum score to consider a match

    for (const libraryBook of libraryBooks) {
      let score = 0;

      // ISBN match is definitive (100 points)
      if (importedBook.isbn13 && libraryBook.isbn_13 === importedBook.isbn13) {
        return { book: libraryBook, score: 100, matchType: 'isbn13' };
      }
      if (importedBook.isbn && libraryBook.isbn === importedBook.isbn) {
        return { book: libraryBook, score: 100, matchType: 'isbn' };
      }

      // Title similarity (up to 60 points)
      const titleScore = this.calculateSimilarity(importedBook.title, libraryBook.title);
      score += (titleScore / 100) * 60;

      // Author similarity (up to 40 points)
      const authorScore = this.calculateSimilarity(importedBook.author, libraryBook.author);
      score += (authorScore / 100) * 40;

      // Bonus for year match (10 points)
      if (importedBook.publishedYear && libraryBook.published_date) {
        const bookYear = libraryBook.published_date.substring(0, 4);
        if (bookYear === String(importedBook.publishedYear)) {
          score += 10;
        }
      }

      if (score > bestScore && score >= THRESHOLD) {
        bestScore = score;
        bestMatch = {
          book: libraryBook,
          score: Math.round(score),
          matchType: 'fuzzy'
        };
      }
    }

    return bestMatch;
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

    const allLibraryBooks = await Book.findAll(10000, 0);
    console.log(`Library has ${allLibraryBooks.length} books`);

    for (const importedBook of importedBooks) {
      try {
        
        let match = this.findBestMatch(importedBook, allLibraryBooks);

        const isToRead = importedBook.exclusiveShelf === 'to-read';

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
if (match) {
          console.log(`✓ MATCHED: "${importedBook.title}" -> Book ID ${match.book.id} (score: ${match.score}, type: ${match.matchType})`);

          // Save to goodreads_imports tracking table
          try {
            await this.saveImportedBook(userId, match.book.id, importedBook);
            console.log(`  Saved to tracking table`);
          } catch (saveError) {
            console.error(`  Error saving to tracking table:`, saveError);
          }

          results.matched.push({
            imported: importedBook,
            existing: match.book,
            matchScore: match.score,
            matchType: match.matchType
          });

          if (isToRead) {
            results.matchedToRead.push({
              imported: importedBook,
              existing: match.book,
              matchScore: match.score,
              matchType: match.matchType
            });
          }
        } else {
          console.log(`✗ NOT FOUND: "${importedBook.title}" by ${importedBook.author} (shelf: ${importedBook.exclusiveShelf})`);
          results.notFound.push(importedBook);

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
        `INSERT OR IGNORE INTO goodreads_imports (user_id, book_id, title, author, isbn, shelf, imported_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
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
    const Request = require('../models/BookRequest');
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
        const { processBookRequest } = require('../controllers/requestController');
        processBookRequest(request.id).catch(err => {
          console.error(`Error processing book request for ${book.title}:`, err);
        });
      } catch (error) {
        console.error(`Error creating request for ${book.title}:`, error);
      }
    }

    return requests;
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
          shelf: m.imported.exclusiveShelf,
          matchScore: m.matchScore,
          matchType: m.matchType
        })),
        matchedToReadBooks: matchResults.matchedToRead.map(m => ({
          title: m.imported.title,
          author: m.imported.author,
          existingId: m.existing.id,
          matchScore: m.matchScore,
          matchType: m.matchType
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
