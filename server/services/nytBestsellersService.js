const axios = require('axios');
const BookRequest = require('../models/BookRequest');
const Book = require('../models/Book');
const { processBookRequest } = require('../controllers/requestController');

class NYTBestsellersService {
  constructor() {
    this.interval = null;
    this.apiKey = process.env.NYT_API_KEY;
    this.baseUrl = 'https://api.nytimes.com/svc/books/v3';
    // Default: check weekly (every 7 days)
    this.checkInterval = parseInt(process.env.NYT_CHECK_INTERVAL) || 7 * 24 * 60 * 60 * 1000;
    // Categories to fetch (can be configured via env)
    this.categories = (process.env.NYT_CATEGORIES || 'combined-print-and-e-book-fiction,combined-print-and-e-book-nonfiction').split(',');
    // Admin user ID for creating requests
    this.adminUserId = parseInt(process.env.NYT_ADMIN_USER_ID) || 1;
  }

  start() {
    if (!process.env.NYT_ENABLED || process.env.NYT_ENABLED !== 'true') {
      console.log('NYT Bestsellers service disabled');
      return;
    }

    if (!this.apiKey) {
      console.error('NYT_API_KEY not configured - bestsellers service disabled');
      return;
    }

    console.log(`Starting NYT Bestsellers service (checking every ${this.checkInterval / 1000 / 60 / 60 / 24} days)`);
    
    // Run initial check after 10 minutes
    setTimeout(() => this.checkBestsellers(), 10 * 60 * 1000);
    
    // Set up periodic checking
    this.interval = setInterval(() => this.checkBestsellers(), this.checkInterval);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Fetch and process bestsellers from all configured categories
   */
  async checkBestsellers() {
    try {
      console.log('[NYT] Checking for new bestsellers...');
      
      let totalNew = 0;
      let totalSkipped = 0;

      for (const category of this.categories) {
        try {
          const result = await this.fetchAndProcessCategory(category.trim());
          totalNew += result.new;
          totalSkipped += result.skipped;
        } catch (error) {
          console.error(`[NYT] Error processing category ${category}:`, error.message);
        }

        // Rate limiting - NYT API has limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log(`[NYT] Bestsellers check complete: ${totalNew} new requests, ${totalSkipped} already in library/requested`);
    } catch (error) {
      console.error('[NYT] Error checking bestsellers:', error);
    }
  }

  /**
   * Fetch bestsellers for a specific category
   * @param {string} listName - NYT list name (e.g., 'combined-print-and-e-book-fiction')
   */
  async fetchAndProcessCategory(listName) {
    console.log(`[NYT] Fetching bestsellers for: ${listName}`);

    const response = await axios.get(`${this.baseUrl}/lists/current/${listName}.json`, {
      params: {
        'api-key': this.apiKey
      },
      timeout: 30000
    });

    if (!response.data || !response.data.results || !response.data.results.books) {
      console.log(`[NYT] No books found for ${listName}`);
      return { new: 0, skipped: 0 };
    }

    const books = response.data.results.books;
    console.log(`[NYT] Found ${books.length} books in ${listName}`);

    let newRequests = 0;
    let skipped = 0;

    for (const book of books) {
      try {
        const result = await this.processBook(book, listName);
        if (result === 'created') {
          newRequests++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`[NYT] Error processing book "${book.title}":`, error.message);
      }
    }

    return { new: newRequests, skipped };
  }

  /**
   * Process a single bestseller book
   * @param {Object} book - NYT book object
   * @param {string} listName - The list it came from
   * @returns {string} - 'created', 'exists', or 'requested'
   */
  async processBook(book, listName) {
    const title = book.title;
    const author = book.author;
    const isbn13 = book.primary_isbn13;
    const isbn10 = book.primary_isbn10;

    // Check if book already exists in library
    if (isbn13) {
      const existingByIsbn = await Book.findByISBN(isbn13);
      if (existingByIsbn) {
        console.log(`[NYT] Already in library: "${title}" (ISBN)`);
        return 'exists';
      }
    }

    // Check by title/author
    const existingByTitle = await Book.findByTitleAndAuthor(title, author);
    if (existingByTitle) {
      console.log(`[NYT] Already in library: "${title}" (title/author)`);
      return 'exists';
    }

    // Check if already requested (pending or downloading)
    const existingRequest = await this.findExistingRequest(title, author, isbn13);
    if (existingRequest) {
      console.log(`[NYT] Already requested: "${title}" (status: ${existingRequest.status})`);
      return 'requested';
    }

    // Create new request
    console.log(`[NYT] Creating request for: "${title}" by ${author}`);
    
    const requestData = {
      user_id: this.adminUserId,
      title: title,
      author: author,
      isbn: isbn13 || isbn10,
      notes: `NYT Bestseller - ${listName} (Rank: ${book.rank})`
    };

    const request = await BookRequest.create(requestData);

    // Trigger background processing
    processBookRequest(request.id).catch(err => {
      console.error(`[NYT] Error processing request for "${title}":`, err.message);
    });

    return 'created';
  }

  /**
   * Check if a book has already been requested
   */
  async findExistingRequest(title, author, isbn) {
    const { db } = require('../database/init');

    return new Promise((resolve, reject) => {
      const statusCheck = `(
        status IN ('pending', 'searching', 'downloading', 'completed')
        OR (status = 'failed' AND created_at > datetime('now', '-7 days'))
      )`;  
      // Check by ISBN first if available
      if (isbn) {
        db.get(
          `SELECT * FROM book_requests 
           WHERE isbn = ? AND ${statusCheck}`,
          [isbn],
          (err, row) => {
            if (err) {
              reject(err);
              return;
            }
            if (row) {
              resolve(row);
              return;
            }

            // If no ISBN match, check by title/author
            db.get(
              `SELECT * FROM book_requests 
               WHERE LOWER(title) = LOWER(?) 
               AND LOWER(author) LIKE LOWER(?)
               AND ${statusCheck}`,
              [title, `%${author}%`],
              (err, row) => {
                if (err) reject(err);
                else resolve(row);
              }
            );
          }
        );
      } else {
        // No ISBN, check by title/author only
        db.get(
          `SELECT * FROM book_requests 
           WHERE LOWER(title) = LOWER(?) 
           AND LOWER(author) LIKE LOWER(?)
           AND ${statusCheck}`,
          [title, `%${author}%`],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      }
    });
  }

  /**
   * Get available NYT list names
   */
  async getAvailableLists() {
    try {
      const response = await axios.get(`${this.baseUrl}/lists/names.json`, {
        params: {
          'api-key': this.apiKey
        },
        timeout: 30000
      });

      return response.data.results.map(list => ({
        name: list.list_name_encoded,
        displayName: list.display_name,
        updated: list.updated
      }));
    } catch (error) {
      console.error('[NYT] Error fetching list names:', error.message);
      return [];
    }
  }

  /**
   * Manual trigger for bestsellers check (can be called from API)
   */
  async triggerCheck() {
    if (!this.apiKey) {
      return { status: 'error', message: 'NYT API key not configured' };
    }

    console.log('[NYT] Manual bestsellers check triggered');
    await this.checkBestsellers();
    return { status: 'completed' };
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      enabled: process.env.NYT_ENABLED === 'true',
      apiKeyConfigured: !!this.apiKey,
      checkIntervalDays: this.checkInterval / (24 * 60 * 60 * 1000),
      categories: this.categories,
      adminUserId: this.adminUserId
    };
  }
}

module.exports = new NYTBestsellersService();
