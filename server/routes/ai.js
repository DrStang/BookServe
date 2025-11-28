const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const ollamaAI = require('../services/ollamaAI');
const Book = require('../models/Book');
const ReadingProgress = require('../models/ReadingProgress');
const cache = require('../services/redisCache');

/**
 * GET /api/ai/status
 * Check if AI service is available
 */
router.get('/status', async (req, res) => {
  try {
    const available = await ollamaAI.isServiceAvailable();
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
 * Get personalized book recommendations
 */
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    // Check cache first
    const cacheKey = `ai:recommendations:${req.user.id}:${limit}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get user's reading history
    const progress = await ReadingProgress.findByUserId(req.user.id);
    const readBooks = await Promise.all(
      progress.map(p => Book.findById(p.book_id))
    );

    // Get all available books
    const allBooks = await Book.findAll();

    // Get recommendations
    const recommendations = await ollamaAI.getRecommendations(
      readBooks.filter(Boolean),
      allBooks,
      limit
    );

    // Enrich with full book details
    const enriched = await Promise.all(
      recommendations.map(async (rec) => {
        const book = await Book.findById(rec.id);
        return {
          book,
          reason: rec.reason,
          score: rec.score || 0
        };
      })
    );

    // Cache for 1 hour
    await cache.set(cacheKey, enriched, 3600);

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai/insights
 * Get reading insights and patterns
 */
router.get('/insights', authenticateToken, async (req, res) => {
  try {
    // Check cache first
    const cacheKey = `ai:insights:${req.user.id}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get user's reading history
    const progress = await ReadingProgress.findByUserId(req.user.id);
    const readBooks = await Promise.all(
      progress.map(p => Book.findById(p.book_id))
    );

    // Generate insights
    const insights = await ollamaAI.generateReadingInsights(
      readBooks.filter(Boolean)
    );

    // Cache for 6 hours
    await cache.set(cacheKey, insights, 21600);

    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai/summary/:id
 * Get AI-generated summary for a book
 */
router.get('/summary/:id', authenticateToken, async (req, res) => {
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

    // Cache for 24 hours
    await cache.set(cacheKey, summary, 86400);

    res.json({ summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/ask/:id
 * Ask a question about a specific book
 */
router.post('/ask/:id', authenticateToken, async (req, res) => {
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
 * Stream chat with AI
 */
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message, context = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Set up SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = ollamaAI.streamChat(message, context);

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/invalidate-cache
 * Invalidate AI cache for current user (admin only)
 */
router.post('/invalidate-cache', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await cache.invalidatePattern('ai:*');
    res.json({ message: 'AI cache invalidated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
