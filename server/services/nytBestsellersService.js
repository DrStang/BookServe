const axios = require('axios');
const BookRequest = require('../models/BookRequest');
const Book = require('../models/Book');
const { processBookRequest } = require('../controllers/requestController');
const cache = require('./redisCache');

class NYTBestsellersService {
  constructor() {
    this.interval = null;
    this.apiKey = process.env.NYT_API_KEY;
    this.baseUrl = 'https://api.nytimes.com/svc/books/v3';
    // Categories to fetch (can be configured via env)
    this.categories = (process.env.NYT_CATEGORIES || 'combined-print-and-e-book-fiction,combined-print-and-e-book-nonfiction').split(',');
    // Admin user ID for creating requests
    this.adminUserId = parseInt(process.env.NYT_ADMIN_USER_ID) || 1;
    
    // Redis cache keys
    this.cacheKeys = {
      lists: 'nyt:lists',
      lastCheckDate: 'nyt:lastCheckDate',
      lastCheckTimestamp: 'nyt:lastCheckTimestamp',
      bestsellers: 'nyt:bestsellers'
    };
    
    // Cache duration - 7 days in seconds (for Redis)
    this.cacheTTL = 7 * 24 * 60 * 60;
  }

  async start() {
    if (!process.env.NYT_ENABLED || process.env.NYT_ENABLED !== 'true') {
      console.log('[NYT] Bestsellers service disabled');
      return;
    }

    if (!this.apiKey) {
      console.error('[NYT] NYT_API_KEY not configured - service disabled');
      return;
    }

    // Check if Redis is available
    if (!cache.isConnected) {
      console.error('[NYT] Redis not connected - service disabled');
      return;
    }

    console.log('[NYT] Starting NYT Bestsellers service');
    
    // Schedule the check
    await this.scheduleNextCheck();
  }

  stop() {
    if (this.interval) {
      clearTimeout(this.interval);
      this.interval = null;
    }
  }

  /**
   * Calculate milliseconds until next Wednesday 7:30 PM EST
   * NYT lists come out Wednesday evening
   */
  getMillisecondsUntilNextCheck() {
    const now = new Date();
    
    // Target Thursday 00:30 UTC (Wednesday 7:30 PM EST / 8:30 PM EDT)
    const targetHourUTC = 0;
    const targetMinute = 30;
    const targetDay = 4; // Thursday in UTC
    
    const next = new Date(now);
    next.setUTCHours(targetHourUTC, targetMinute, 0, 0);
    
    const currentDay = now.getUTCDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && now >= next)) {
      daysUntil += 7;
    }
    
    next.setUTCDate(next.getUTCDate() + daysUntil);
    
    const msUntil = next.getTime() - now.getTime();
    const hoursUntil = Math.round(msUntil / 1000 / 60 / 60);
    console.log(`[NYT] Next scheduled check: ${next.toISOString()} (${hoursUntil} hours)`);
    
    return msUntil;
  }

  /**
   * Schedule the next bestsellers check
   */
  async scheduleNextCheck() {
    // Check if we need to run now (haven't checked this week)
    const lastCheckTimestamp = await cache.get(this.cacheKeys.lastCheckTimestamp);
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    if (!lastCheckTimestamp || parseInt(lastCheckTimestamp) < oneWeekAgo) {
      console.log('[NYT] No recent check found, running initial check in 2 minutes');
      setTimeout(() => this.checkBestsellers(), 2 * 60 * 1000);
    } else {
      const lastDate = await cache.get(this.cacheKeys.lastCheckDate);
      console.log(`[NYT] Last check was for list date: ${lastDate}`);
    }
    
    // Schedule weekly check
    const msUntilNext = this.getMillisecondsUntilNextCheck();
    this.interval = setTimeout(async () => {
      await this.checkBestsellers();
      await this.scheduleNextCheck();
    }, msUntilNext);
  }

  /**
   * Fetch and process bestsellers from all configured categories
   */
  async checkBestsellers() {
    try {
      console.log('[NYT] Checking for new bestsellers...');
      
      // Fetch overview to get current publish date
      const overview = await this.fetchOverview();
      if (!overview) {
        console.error('[NYT] Failed to fetch overview');
        return { status: 'error', message: 'Failed to fetch NYT overview' };
      }
      
      const publishedDate = overview.results?.published_date;
      
      // Check if we've already processed this list
      const lastCheckDate = await cache.get(this.cacheKeys.lastCheckDate);
      if (lastCheckDate === publishedDate) {
        console.log(`[NYT] Already processed list for ${publishedDate}, skipping`);
        return { status: 'skipped', message: `Already processed ${publishedDate}` };
      }
      
      let totalNew = 0;
      let totalSkipped = 0;
      let totalInLibrary = 0;

      for (const category of this.categories) {
        try {
          const result = await this.fetchAndProcessCategory(category.trim());
          totalNew += result.new;
          totalSkipped += result.skipped;
          totalInLibrary += result.inLibrary;
        } catch (error) {
          console.error(`[NYT] Error processing category ${category}:`, error.message);
        }

        // Rate limiting - NYT API allows 5 req/min, so wait 12 seconds
        await new Promise(resolve => setTimeout(resolve, 12000));
      }

      // Update cache with check timestamp and date
      await cache.set(this.cacheKeys.lastCheckTimestamp, Date.now().toString(), this.cacheTTL);
      await cache.set(this.cacheKeys.lastCheckDate, publishedDate, this.cacheTTL);

      console.log(`[NYT] ✓ Check complete for ${publishedDate}: ${totalNew} new, ${totalInLibrary} in library, ${totalSkipped} already requested`);
      
      return {
        status: 'completed',
        publishedDate,
        newRequests: totalNew,
        inLibrary: totalInLibrary,
        alreadyRequested: totalSkipped
      };
    } catch (error) {
      console.error('[NYT] Error checking bestsellers:', error);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Fetch the overview to get current publish date
   */
  async fetchOverview() {
    try {
      const response = await axios.get(`${this.baseUrl}/lists/overview.json`, {
        params: { 'api-key': this.apiKey },
        timeout: 30000
      });
      return response.data;
    } catch (error) {
      console.error('[NYT] Error fetching overview:', error.message);
      return null;
    }
  }

  /**
   * Fetch bestsellers for a specific category
   */
  async fetchAndProcessCategory(listName) {
    console.log(`[NYT] Fetching: ${listName}`);

    const response = await axios.get(`${this.baseUrl}/lists/current/${listName}.json`, {
      params: { 'api-key': this.apiKey },
      timeout: 30000
    });

    if (!response.data?.results?.books) {
      console.log(`[NYT] No books found for ${listName}`);
      return { new: 0, skipped: 0, inLibrary: 0 };
    }

    const books = response.data.results.books;
    console.log(`[NYT] Found ${books.length} books in ${listName}`);

    let newRequests = 0;
    let skipped = 0;
    let inLibrary = 0;

    for (const book of books) {
      try {
        const result = await this.processBook(book, listName);
        if (result === 'created') {
          newRequests++;
        } else if (result === 'exists') {
          inLibrary++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`[NYT] Error processing "${book.title}":`, error.message);
      }
      
      // Small delay between books
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { new: newRequests, skipped, inLibrary };
  }

  /**
   * Process a single bestseller book with improved duplicate detection
   */
  async processBook(book, listName) {
    const title = book.title;
    const author = book.author;
    const isbn13 = book.primary_isbn13;
    const isbn10 = book.primary_isbn10;

    // =========== CHECK LIBRARY ===========
    
    // Check by ISBN (most reliable)
    if (isbn13) {
      const existing = await Book.findByISBN(isbn13);
      if (existing) {
        console.log(`[NYT] ✓ In library (ISBN13): "${title}"`);
        return 'exists';
      }
    }
    
    if (isbn10) {
      const existing = await Book.findByISBN(isbn10);
      if (existing) {
        console.log(`[NYT] ✓ In library (ISBN10): "${title}"`);
        return 'exists';
      }
    }

    // Check by title/author (fuzzy)
    const existingByTitle = await this.findBookInLibrary(title, author);
    if (existingByTitle) {
      console.log(`[NYT] ✓ In library (title): "${title}"`);
      return 'exists';
    }

    // =========== CHECK EXISTING REQUESTS ===========
    
    const existingRequest = await this.findExistingRequest(title, author, isbn13, isbn10);
    if (existingRequest) {
      console.log(`[NYT] Already requested: "${title}" (${existingRequest.status})`);
      return 'requested';
    }

    // =========== CREATE NEW REQUEST ===========
    
    console.log(`[NYT] + Creating request: "${title}" by ${author}`);
    
    const requestData = {
      user_id: this.adminUserId,
      title: title,
      author: author,
      isbn: isbn13 || isbn10,
      notes: `NYT Bestseller - ${listName} (Rank: ${book.rank})`
    };

    const request = await BookRequest.create(requestData);

    // Trigger processing with random delay (0-60 sec) to spread load
    setTimeout(() => {
      processBookRequest(request.id).catch(err => {
        console.error(`[NYT] Error processing "${title}":`, err.message);
      });
    }, Math.random() * 60000);

    return 'created';
  }

  /**
   * Normalize text for comparison
   */
  normalizeText(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[''`]/g, "'")
      .replace(/[""]/g, '"')
      .replace(/[—–−]/g, '-')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get author's last name for matching
   */
  getAuthorLastName(author) {
    if (!author) return '';
    // Handle "Last, First" format
    if (author.includes(',')) {
      return author.split(',')[0].trim().toLowerCase();
    }
    // Handle "First Last" format
    const parts = author.trim().split(/\s+/);
    return parts[parts.length - 1].toLowerCase();
  }

  /**
   * Find book in library with fuzzy matching
   */
  async findBookInLibrary(title, author) {
    const { db } = require('../database/init');
    const normalizedTitle = this.normalizeText(title);
    const authorLastName = this.getAuthorLastName(author);
    
    return new Promise((resolve, reject) => {
      // Search by normalized title containing key words and author last name
      db.get(
        `SELECT * FROM books 
         WHERE LOWER(title) LIKE ? 
         AND LOWER(author) LIKE ?`,
        [`%${normalizedTitle.substring(0, 30)}%`, `%${authorLastName}%`],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  /**
   * Check if a book has already been requested
   */
  async findExistingRequest(title, author, isbn13, isbn10) {
    const { db } = require('../database/init');
    const normalizedTitle = this.normalizeText(title);
    const authorLastName = this.getAuthorLastName(author);

    return new Promise((resolve, reject) => {
      // Check all statuses that should prevent re-requesting:
      // - Active statuses (pending, searching, downloading)
      // - Recently failed (within 14 days)
      // - Recently completed (within 30 days)
      const query = `
        SELECT * FROM book_requests 
        WHERE (
          -- Check by ISBN13
          (isbn = ? AND ? IS NOT NULL)
          -- Check by ISBN10
          OR (isbn = ? AND ? IS NOT NULL)
          -- Check by title/author similarity
          OR (LOWER(title) LIKE ? AND LOWER(author) LIKE ?)
        )
        AND (
          status IN ('pending', 'searching', 'downloading')
          OR (status = 'failed' AND requested_at > datetime('now', '-14 days'))
          OR (status = 'completed' AND requested_at > datetime('now', '-30 days'))
        )
        LIMIT 1
      `;

      const params = [
        isbn13, isbn13,
        isbn10, isbn10,
        `%${normalizedTitle.substring(0, 25)}%`,
        `%${authorLastName}%`
      ];

      db.get(query, params, (err, row) => {
        if (err) {
          console.error('[NYT] Error checking existing request:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get available NYT list names (cached)
   */
  async getAvailableLists() {
    // Check cache first
    const cached = await cache.get(this.cacheKeys.lists);
    if (cached) {
      try {
        console.log('[NYT] Returning cached lists');
        return JSON.parse(cached);
      } catch (e) {
        // Invalid cache, fetch fresh
      }
    }

    try {
      const url = `${this.baseUrl}/lists/overview.json`;
      console.log('[NYT] Fetching lists from API');
      
      const response = await axios.get(url, {
        params: { 'api-key': this.apiKey },
        timeout: 30000
      });

      if (!response.data?.results?.lists) {
        console.log('[NYT] No lists in response');
        return [];
      }

      const lists = response.data.results.lists.map(list => ({
        name: list.list_name_encoded,
        displayName: list.display_name,
        updated: list.updated
      }));

      // Cache for 7 days
      await cache.set(this.cacheKeys.lists, JSON.stringify(lists), this.cacheTTL);

      return lists;
    } catch (error) {
      console.error('[NYT] Error fetching lists:', error.message);
      return [];
    }
  }

  /**
   * Manual trigger for bestsellers check
   */
  async triggerCheck() {
    if (!this.apiKey) {
      return { status: 'error', message: 'NYT API key not configured' };
    }

    if (!cache.isConnected) {
      return { status: 'error', message: 'Redis not connected' };
    }

    // Rate limit manual triggers to once per hour
    const lastTimestamp = await cache.get(this.cacheKeys.lastCheckTimestamp);
    if (lastTimestamp) {
      const hourAgo = Date.now() - (60 * 60 * 1000);
      if (parseInt(lastTimestamp) > hourAgo) {
        const minutesAgo = Math.round((Date.now() - parseInt(lastTimestamp)) / 1000 / 60);
        const lastDate = await cache.get(this.cacheKeys.lastCheckDate);
        return { 
          status: 'skipped', 
          message: `Already checked ${minutesAgo} minutes ago`,
          lastCheckDate: lastDate
        };
      }
    }

    console.log('[NYT] Manual check triggered');
    return await this.checkBestsellers();
  }

  /**
   * Get service status
   */
  async getStatus() {
    const lastCheckDate = await cache.get(this.cacheKeys.lastCheckDate);
    const lastCheckTimestamp = await cache.get(this.cacheKeys.lastCheckTimestamp);
    
    let cacheValidUntil = null;
    if (lastCheckTimestamp) {
      cacheValidUntil = new Date(parseInt(lastCheckTimestamp) + (this.cacheTTL * 1000)).toISOString();
    }

    return {
      enabled: process.env.NYT_ENABLED === 'true',
      apiKeyConfigured: !!this.apiKey,
      redisConnected: cache.isConnected,
      categories: this.categories,
      adminUserId: this.adminUserId,
      lastCheckDate: lastCheckDate || null,
      lastCheckTimestamp: lastCheckTimestamp 
        ? new Date(parseInt(lastCheckTimestamp)).toISOString() 
        : null,
      cacheValidUntil
    };
  }
}

module.exports = new NYTBestsellersService();
