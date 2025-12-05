const cache = require('./redisCache');
const ollamaAI = require('./ollamaAI');
const Book = require('../models/Book');
const ReadingProgress = require('../models/ReadingProgress');
const { db } = require('../database/init');

class AICacheService {
  constructor() {
    this.updateQueue = new Set();
    this.isProcessing = false;
    this.updateInterval = null;
    // Default: update every 3 days
    this.autoUpdateIntervalDays = parseInt(process.env.AI_AUTO_UPDATE_DAYS) || 3;
    this.cacheTTL = {
      recommendations: 7 * 24 * 60 * 60, // 7 days
      insights: 7 * 24 * 60 * 60, // 7 days
    };
  }

  /**
   * Start the background update service
   */
  start() {
    if (!process.env.AI_CACHE_ENABLED || process.env.AI_CACHE_ENABLED !== 'true') {
      console.log('AI cache service disabled');
      return;
    }

    console.log(`Starting AI cache service (auto-update every ${this.autoUpdateIntervalDays} days)`);
    
    // Run initial check after 5 minutes
    setTimeout(() => this.checkStaleCache(), 5 * 60 * 1000);
    
    // Check for stale cache every 6 hours
    this.updateInterval = setInterval(
      () => this.checkStaleCache(),
      6 * 60 * 60 * 1000
    );
  }

  /**
   * Stop the service
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Check for users with stale AI cache and queue updates
   */
  async checkStaleCache() {
    try {
      console.log('[AI Cache] Checking for stale cache...');
      
      const users = await this.getAllUsers();
      const staleThreshold = Date.now() - (this.autoUpdateIntervalDays * 24 * 60 * 60 * 1000);

      for (const user of users) {
        const lastUpdate = await this.getLastUpdateTime(user.id);
        
        if (!lastUpdate || lastUpdate < staleThreshold) {
          console.log(`[AI Cache] User ${user.id} (${user.username}) cache is stale, queuing update`);
          this.queueUserUpdate(user.id);
        }
      }

      this.processQueue();
    } catch (error) {
      console.error('[AI Cache] Error checking stale cache:', error);
    }
  }

  /**
   * Queue a user for AI cache update
   */
  queueUserUpdate(userId) {
    this.updateQueue.add(userId);
    console.log(`[AI Cache] User ${userId} queued for update (queue size: ${this.updateQueue.size})`);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process the update queue
   */
  async processQueue() {
    if (this.isProcessing || this.updateQueue.size === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`[AI Cache] Processing queue (${this.updateQueue.size} users)`);

    while (this.updateQueue.size > 0) {
      const userId = this.updateQueue.values().next().value;
      this.updateQueue.delete(userId);

      try {
        await this.updateUserCache(userId);
        
        // Add delay between users to avoid overwhelming the AI service
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.error(`[AI Cache] Error updating cache for user ${userId}:`, error);
      }
    }

    this.isProcessing = false;
    console.log('[AI Cache] Queue processing complete');
  }

  /**
   * Update AI cache for a specific user
   */
  async updateUserCache(userId) {
    try {
      console.log(`[AI Cache] Updating cache for user ${userId}...`);

      // Check if AI service is available
      const aiAvailable = await ollamaAI.isServiceAvailable();
      if (!aiAvailable) {
        console.log('[AI Cache] AI service not available, skipping update');
        return;
      }

      // Update recommendations
      await this.updateRecommendations(userId);

      // Update insights
      await this.updateInsights(userId);

      // Store last update time
      await this.setLastUpdateTime(userId);

      console.log(`[AI Cache] ✓ Cache updated for user ${userId}`);
    } catch (error) {
      console.error(`[AI Cache] Error updating cache for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update recommendations cache
   */
  async updateRecommendations(userId) {
    try {
      // Get user's reading history from site
      const siteProgress = await ReadingProgress.getAllProgress(userId);
      const siteReadBooks = await Promise.all(
        siteProgress
          .filter(p => p.progress >= 90)
          .map(p => Book.findById(p.book_id))
      );

      // Get Goodreads read books
      const goodreadsReadBooks = await this.getGoodreadsReadBooks(userId);

      // Combine and deduplicate
      const allReadBooks = this.deduplicateBooks([
        ...siteReadBooks.filter(Boolean),
        ...goodreadsReadBooks
      ]);

      console.log(`[AI Cache] User ${userId}: ${allReadBooks.length} unique read books`);

      // Get available books
      const allBooks = await Book.findAll(1000, 0);
      const readBookIds = new Set(allReadBooks.map(b => b.id));
      const unreadBooks = allBooks.filter(b => !readBookIds.has(b.id));

      if (allReadBooks.length === 0 || unreadBooks.length === 0) {
        console.log(`[AI Cache] User ${userId}: Not enough data for recommendations`);
        return;
      }

      // Generate recommendations for different limits
      const limits = [5, 10, 20];
      
      for (const limit of limits) {
        const recommendations = await ollamaAI.getRecommendations(
          allReadBooks,
          unreadBooks,
          limit
        );

        // Enrich with full book details
        const enriched = await Promise.all(
          recommendations.map(async (rec) => {
            const book = await Book.findById(rec.id);
            return {
              book,
              reason: rec.reason,
              score: rec.score || 0.7
            };
          })
        );

        const result = {
          recommendations: enriched.filter(r => r.book),
          metadata: {
            total_books_analyzed: allReadBooks.length,
            site_books: siteReadBooks.filter(Boolean).length,
            goodreads_books: goodreadsReadBooks.length,
            available_for_recommendation: unreadBooks.length,
            generated_at: new Date().toISOString()
          }
        };

        // Cache with long TTL
        const cacheKey = `ai:recommendations:${userId}:${limit}`;
        await cache.set(cacheKey, result, this.cacheTTL.recommendations);
        console.log(`[AI Cache] ✓ Cached ${limit} recommendations for user ${userId}`);
      }
    } catch (error) {
      console.error(`[AI Cache] Error updating recommendations for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update insights cache
   */
  async updateInsights(userId) {
    try {
      // Get user's reading history
      const siteProgress = await ReadingProgress.getAllProgress(userId);
      const siteReadBooks = await Promise.all(
        siteProgress.map(p => Book.findById(p.book_id))
      );

      // Get Goodreads read books
      const goodreadsReadBooks = await this.getGoodreadsReadBooks(userId);

      // Combine and deduplicate
      const allReadBooks = this.deduplicateBooks([
        ...siteReadBooks.filter(Boolean),
        ...goodreadsReadBooks
      ]);

      console.log(`[AI Cache] User ${userId}: Generating insights from ${allReadBooks.length} books`);

      if (allReadBooks.length === 0) {
        console.log(`[AI Cache] User ${userId}: Not enough data for insights`);
        return;
      }

      // Generate insights
      const insights = await ollamaAI.generateReadingInsights(allReadBooks);

      const result = {
        ...insights,
        metadata: {
          total_books_analyzed: allReadBooks.length,
          site_books: siteReadBooks.filter(Boolean).length,
          goodreads_books: goodreadsReadBooks.length,
          generated_at: new Date().toISOString()
        }
      };

      // Cache with long TTL
      const cacheKey = `ai:insights:${userId}`;
      await cache.set(cacheKey, result, this.cacheTTL.insights);
      console.log(`[AI Cache] ✓ Cached insights for user ${userId}`);
    } catch (error) {
      console.error(`[AI Cache] Error updating insights for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Trigger cache update when reading progress changes
   */
  async onProgressUpdate(userId, bookId, progress) {
    // Only queue update if book is finished (90%+)
    if (progress >= 90) {
      console.log(`[AI Cache] Book ${bookId} marked as read for user ${userId}, queuing cache update`);
      this.queueUserUpdate(userId);
    }
  }

  /**
   * Trigger cache update when book is added
   */
  async onBookAdded(bookId) {
    console.log(`[AI Cache] New book ${bookId} added, queuing updates for all users`);
    
    // Queue updates for all users
    const users = await this.getAllUsers();
    for (const user of users) {
      this.queueUserUpdate(user.id);
    }
  }

  /**
   * Trigger cache update when Goodreads import completes
   */
  async onGoodreadsImport(userId) {
    console.log(`[AI Cache] Goodreads import completed for user ${userId}, queuing cache update`);
    this.queueUserUpdate(userId);
  }

  /**
   * Helper: Get Goodreads read books
   */
  async getGoodreadsReadBooks(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT b.*, gi.shelf, gi.imported_at
         FROM goodreads_imports gi
         INNER JOIN books b ON gi.book_id = b.id
         WHERE gi.user_id = ? AND gi.shelf = 'read'
         ORDER BY gi.imported_at DESC`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Helper: Deduplicate books
   */
  deduplicateBooks(books) {
    const bookMap = new Map();
    
    books.forEach(book => {
      const key = `${book.title.toLowerCase()}|${(book.author || '').toLowerCase()}`;
      
      if (!bookMap.has(key)) {
        bookMap.set(key, book);
      } else {
        const existing = bookMap.get(key);
        const existingRating = existing.average_rating || 0;
        const newRating = book.average_rating || 0;
        
        if (newRating > existingRating) {
          bookMap.set(key, book);
        }
      }
    });
    
    return Array.from(bookMap.values());
  }

  /**
   * Helper: Get all users
   */
  async getAllUsers() {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT id, username, email FROM users',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Helper: Get last update time for user
   */
  async getLastUpdateTime(userId) {
    const key = `ai:last_update:${userId}`;
    const timestamp = await cache.get(key);
    return timestamp ? parseInt(timestamp) : null;
  }

  /**
   * Helper: Set last update time for user
   */
  async setLastUpdateTime(userId) {
    const key = `ai:last_update:${userId}`;
    await cache.set(key, Date.now(), 30 * 24 * 60 * 60); // 30 days TTL
  }

  /**
   * Get queue status (for monitoring/admin)
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      queueSize: this.updateQueue.size,
      autoUpdateIntervalDays: this.autoUpdateIntervalDays,
      cacheTTL: this.cacheTTL
    };
  }
}

module.exports = new AICacheService();
