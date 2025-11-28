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
            isbn: row['ISBN'] ? `="${row['ISBN']}"` : null, // Goodreads prefixes with =
            isbn13: row['ISBN13'] ? `="${row['ISBN13']}"` : null,
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
   * @returns {Promise<Object>} Match results with found/missing books
   */
  static async matchBooks(importedBooks) {
    const results = {
      matched: [],
      matchedToRead: [], // Matched books that are on "to-read" shelf
      notFound: [],
      notFoundToRead: [], // Not found books that are on "to-read" shelf
      errors: []
    };

    for (const importedBook of importedBooks) {
      try {
        // Try to find book by ISBN first (most accurate)
        let matchedBook = null;

        if (importedBook.isbn13) {
          matchedBook = await Book.findByISBN(importedBook.isbn13);
        }

        if (!matchedBook && importedBook.isbn) {
          matchedBook = await Book.findByISBN(importedBook.isbn);
        }

        // If no ISBN match, try title + author
        if (!matchedBook) {
          matchedBook = await Book.findByTitleAndAuthor(
            importedBook.title,
            importedBook.author
          );
        }

        const isToRead = importedBook.exclusiveShelf === 'to-read';

        if (matchedBook) {
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
          results.notFound.push(importedBook);

          // Track not found to-read books separately
          if (isToRead) {
            results.notFoundToRead.push(importedBook);
          }
        }
      } catch (error) {
        results.errors.push({
          book: importedBook,
          error: error.message
        });
      }
    }

    return results;
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
      } catch (error) {
        console.error(`Error creating request for ${book.title}:`, error);
      }
    }

    return requests;
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
