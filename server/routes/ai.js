const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const ollamaAI = require('../services/ollamaAI');
const Book = require('../models/Book');
const ReadingProgress = require('../models/ReadingProgress');
const { db } = require('../database/init');
const cache = require('../services/redisCache');
const aiCacheService = require('../services/aiCacheService');

/**
 * Helper function to get Goodreads read books for recommendations
 */
async function getGoodreadsReadBooks(userId) {
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
 * Deduplicate books by title and author (case-insensitive)
 * When duplicates found, keep the one with higher rating
 */
function deduplicateBooks(books) {
  const bookMap = new Map();
  
  books.forEach(book => {
    const key = `${book.title.toLowerCase()}|${(book.author || '').toLowerCase()}`;
    
    if (!bookMap.has(key)) {
      bookMap.set(key, book);
    } else {
      // Keep book with higher rating
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
 * GET /api/ai/status
 * Check if AI service is available
 */
router.get('/status', async (req, res) => {
  try {
    const available = await ollamaAI.isServiceAvailable();
    const cacheStatus = aiCacheService.getStatus();
    
    res.json({
      available,
      model: ollamaAI.model,
      host: ollamaAI.host
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai/recommendations
 * Get personalized book recommendations including Goodreads history
 */
router.get('/recommendations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    // Check cache first
    const cacheKey = `ai:recommendations:${req.user.id}:${limit}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      console.log(`[AI] Serving cached recommendations for user ${req.user.id}`);
      return res.json({
        ...cached,
        fromCache: true
      });
    }
    console.log(`[AI] Cache miss - generating fresh recommendations for user ${req.user.id}`);

        // Check if AI is available
    const aiAvailable = await ollamaAI.isServiceAvailable();
    if (!aiAvailable) {
      return res.status(503).json({ 
        error: 'AI service unavailable',
        message: 'The AI recommendation service is currently offline. Please try again later.'
      });
    }

    // Get user's reading history from site
    const siteProgress = await ReadingProgress.getAllProgress(req.user.id);
    const siteReadBooks = await Promise.all(
      siteProgress
        .filter(p => p.progress >= 90) // Only include mostly-read books
        .map(p => Book.findById(p.book_id))
    );

    // Get user's Goodreads read books
    const goodreadsReadBooks = await getGoodreadsReadBooks(req.user.id);

    // Combine and deduplicate
    const allReadBooks = deduplicateBooks([
      ...siteReadBooks.filter(Boolean),
      ...goodreadsReadBooks
    ]);

    console.log(`[AI] User ${userId}: ${siteReadBooks.filter(Boolean).length} site books, ${goodreadsReadBooks.length} Goodreads books, ${allReadBooks.length} unique total`);

    if (allReadBooks.length === 0) {
      return res.json({
        recommendations: [],
        message: 'Start reading some books to get personalized recommendations!',
        metadata: {
          total_books_analyzed: 0,
          site_books: 0,
          goodreads_books: 0
        }
      });
    }


    // Get all available books for recommendations
    const allBooks = await Book.findAll(1000, 0);

    // Filter out books already read
    const readBookIds = new Set(allReadBooks.map(b => b.id));
    const unreadBooks = allBooks.filter(b => !readBookIds.has(b.id));

     if (unreadBooks.length === 0) {
      return res.json({
        recommendations: [],
        message: 'You\'ve read all the books in the library! Add more books to get recommendations.',
        metadata: {
          total_books_analyzed: allReadBooks.length,
          site_books: siteReadBooks.filter(Boolean).length,
          goodreads_books: goodreadsReadBooks.length
        }
      });
    }

    // Get AI recommendations
    const recommendations = await ollamaAI.getRecommendations(
      allReadBooks,
      unreadBooks,
      limit
    );
// Enrich recommendations with full book details
    const enrichedRecommendations = await Promise.all(
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
      recommendations: enrichedRecommendations.filter(r => r.book),
      metadata: {
        total_books_analyzed: allReadBooks.length,
        site_books: siteReadBooks.filter(Boolean).length,
        goodreads_books: goodreadsReadBooks.length,
        available_for_recommendation: unreadBooks.length,
        generated_at: new Date().toISOString()
      }
    };
    
    // Cache for 1 hour
    await cache.set(cacheKey, result, 7 * 24 * 60 * 60);

    aiCacheService.queueUserUpdate(req.user.id);

    res.json(result);
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai/insights
 * Get reading insights and patterns including Goodreads data
 */
router.get('/insights', authMiddleware, async (req, res) => {
  try {
    // Check cache first
    const cacheKey = `ai:insights:${req.user.id}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      console.log(`[AI] Serving cached insights for user ${req.user.id}`);
      return res.json({
        ...cached,
        fromCache: true
      });
    }

    console.log(`[AI] Cache miss - generating fresh insights for user ${req.user.id}`);

        // Check if AI is available
    const aiAvailable = await ollamaAI.isServiceAvailable();
    if (!aiAvailable) {
      return res.status(503).json({ 
        error: 'AI service unavailable',
        message: 'The AI insights service is currently offline. Please try again later.'
      });
    }
    // Get user's reading history from site
    const siteProgress = await ReadingProgress.getAllProgress(req.user.id);
    const siteReadBooks = await Promise.all(
      siteProgress.map(p => Book.findById(p.book_id))
    );

    // Get user's Goodreads read books
    const goodreadsReadBooks = await getGoodreadsReadBooks(req.user.id);

    // Combine and deduplicate
    const allReadBooks = deduplicateBooks([
      ...siteReadBooks.filter(Boolean),
      ...goodreadsReadBooks
    ]);

    if (allReadBooks.length === 0) {
      return res.json({
        insights: null,
        message: 'Start reading books to get personalized insights!',
        metadata: {
          total_books_analyzed: 0
        }
      });
    }
            
    // Generate insights
    const insights = await ollamaAI.generateReadingInsights(allReadBooks);

    // Add metadata
    const result = {
      ...insights,
      metadata: {
        total_books_analyzed: allReadBooks.length,
        site_books: siteReadBooks.filter(Boolean).length,
        goodreads_books: goodreadsReadBooks.length,
        generated_at: new Date().toISOString()
      }
    };

    // Cache for 6 hours
    await cache.set(cacheKey, result, 7 * 24 * 60 * 60);

    res.json(result);
  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai/summary/:id
 * Get AI-generated summary for a book
 */
router.get('/summary/:id', authMiddleware, async (req, res) => {
  try {
    const bookId = req.params.id;

    // Check cache first
    const cacheKey = `ai:summary:${bookId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ summary: cached });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const summary = await ollamaAI.generateBookSummary(book);

    // Cache for 30 days
    await cache.set(cacheKey, summary, 30 * 24 * 60 * 60);

    res.json({ summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/ask/:id
 * Ask a question about a specific book
 */
router.post('/ask/:id', authMiddleware, async (req, res) => {
  try {
    const bookId = req.params.id;
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const answer = await ollamaAI.answerBookQuestion(book, question);

    res.json({ answer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/chat
 * Chat with AI (non-streaming for compatibility)
 */
router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { message, context = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Collect streaming response into single answer
    const stream = ollamaAI.streamChat(message, context);
    let fullAnswer = '';

    for await (const chunk of stream) {
      fullAnswer += chunk;
    }

    res.json({ answer: fullAnswer });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});
/**
 * GET /api/ai/cache-status
 * Get AI cache service status (admin only)
 */
router.get('/cache-status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // getStatus is now async
    const status = await aiCacheService.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting AI cache status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/trigger-update
 * Trigger background AI cache update for current user
 */
router.post('/trigger-update', authMiddleware, async (req, res) => {
  try {
    // Trigger async update (don't wait)
    aiCacheService.queueUserUpdate(req.user.id);
    
    res.json({ 
      message: 'AI cache update queued',
      userId: req.user.id 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


/**
 * POST /api/ai/invalidate-cache
 * Invalidate AI cache (admin only)
 */
router.post('/invalidate-cache', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId, pattern } = req.body;
    
    if (userId) {
      // Invalidate specific user's cache
      await cache.del(`ai:recommendations:${userId}:5`);
      await cache.del(`ai:recommendations:${userId}:10`);
      await cache.del(`ai:recommendations:${userId}:20`);
      await cache.del(`ai:insights:${userId}`);
      await cache.del(`ai:last_update:${userId}`);
      res.json({ message: `AI cache invalidated for user ${userId}` });
    } else if (pattern) {
      // Invalidate by pattern
      await cache.invalidatePattern(pattern);
      res.json({ message: `AI cache invalidated for pattern: ${pattern}` });
    } else {
      // Invalidate all AI cache
      await cache.invalidatePattern('ai:*');
      res.json({ message: 'All AI cache invalidated' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
