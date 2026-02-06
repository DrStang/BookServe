/**
 * Full-Text Search Routes for BookServe
 *
 * Provides endpoints for:
 * - Searching inside book contents
 * - Managing the search index
 * - Viewing indexing status
 *
 * Usage: Add to server/index.js: app.use('/api/search', searchRoutes);
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const fullTextSearchService = require('../services/fullTextSearchService');

/**
 * GET /api/search
 * Search across all books
 * Query params:
 *   - q: search query (required)
 *   - limit: max results (default 50)
 *   - offset: pagination offset (default 0)
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { q, limit = 50, offset = 0 } = req.query;

        if (!q || q.trim().length === 0) {
            return res.status(400).json({ error: 'Search query required' });
        }

        // Sanitize and prepare query for FTS
        // Remove special characters that might break FTS
        const sanitizedQuery = q.trim()
            .replace(/[^\w\s"'-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (sanitizedQuery.length < 2) {
            return res.status(400).json({ error: 'Search query too short' });
        }

        const results = await fullTextSearchService.search(sanitizedQuery, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            query: q,
            count: results.length,
            results: results.map(r => ({
                bookId: parseInt(r.book_id),
                bookTitle: r.book_title,
                bookAuthor: r.book_author,
                coverImage: r.cover_image,
                chapterTitle: r.chapter_title,
                snippet: r.snippet,
                relevance: r.relevance
            }))
        });

    } catch (error) {
        console.error('[Search] Error:', error);
        res.status(500).json({ error: 'Search failed', message: error.message });
    }
});

/**
 * GET /api/search/book/:id
 * Search within a specific book
 */
router.get('/book/:id', authMiddleware, async (req, res) => {
    try {
        const bookId = parseInt(req.params.id);
        const { q, limit = 50, offset = 0 } = req.query;

        if (!q || q.trim().length === 0) {
            return res.status(400).json({ error: 'Search query required' });
        }

        const sanitizedQuery = q.trim()
            .replace(/[^\w\s"'-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const results = await fullTextSearchService.searchInBook(bookId, sanitizedQuery, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            bookId,
            query: q,
            count: results.length,
            results: results.map(r => ({
                chapterTitle: r.chapter_title,
                snippet: r.snippet,
                relevance: r.relevance
            }))
        });

    } catch (error) {
        console.error('[Search] Error:', error);
        res.status(500).json({ error: 'Search failed', message: error.message });
    }
});

/**
 * GET /api/search/status
 * Get indexing status (admin only)
 */
router.get('/status', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const [stats, status] = await Promise.all([
            fullTextSearchService.getStats(),
            fullTextSearchService.getIndexStatus()
        ]);

        res.json({
            stats,
            isIndexing: fullTextSearchService.isIndexing(),
            books: status
        });

    } catch (error) {
        console.error('[Search] Error getting status:', error);
        res.status(500).json({ error: 'Failed to get status', message: error.message });
    }
});

/**
 * GET /api/search/stats
 * Get quick stats (all users)
 */
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const stats = await fullTextSearchService.getStats();
        res.json({
            ...stats,
            isIndexing: fullTextSearchService.isIndexing()
        });
    } catch (error) {
        console.error('[Search] Error getting stats:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

/**
 * POST /api/search/index
 * Trigger indexing of all unindexed books (admin only)
 */
router.post('/index', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { force = false } = req.body;

        if (fullTextSearchService.isIndexing()) {
            return res.status(409).json({
                error: 'Indexing already in progress',
                message: 'Please wait for current indexing to complete'
            });
        }

        // Start indexing in background
        fullTextSearchService.indexAllBooks(force).then(result => {
            console.log('[Search] Background indexing complete:', result);
        }).catch(err => {
            console.error('[Search] Background indexing error:', err);
        });

        res.json({
            message: 'Indexing started',
            note: 'Indexing runs in the background. Check /api/search/status for progress.'
        });

    } catch (error) {
        console.error('[Search] Error starting indexing:', error);
        res.status(500).json({ error: 'Failed to start indexing', message: error.message });
    }
});

/**
 * POST /api/search/index/:id
 * Index a specific book (admin only)
 */
router.post('/index/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const bookId = parseInt(req.params.id);

        // Get book info
        const { db } = require('../database/init');
        const book = await new Promise((resolve, reject) => {
            db.get('SELECT id, file_path, format FROM books WHERE id = ?', [bookId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!book) {
            return res.status(404).json({ error: 'Book not found' });
        }

        if (book.format !== 'epub') {
            return res.status(400).json({
                error: 'Unsupported format',
                message: 'Only EPUB files can be indexed for full-text search'
            });
        }

        const result = await fullTextSearchService.indexBook(bookId, book.file_path);

        if (result.success) {
            res.json({
                message: 'Book indexed successfully',
                chapters: result.chapters,
                words: result.words
            });
        } else {
            res.status(500).json({
                error: 'Indexing failed',
                message: result.error
            });
        }

    } catch (error) {
        console.error('[Search] Error indexing book:', error);
        res.status(500).json({ error: 'Failed to index book', message: error.message });
    }
});

/**
 * DELETE /api/search/index/:id
 * Remove a book from the search index (admin only)
 */
router.delete('/index/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const bookId = parseInt(req.params.id);
        await fullTextSearchService.deleteBookIndex(bookId);

        // Also remove status
        const { db } = require('../database/init');
        await new Promise((resolve) => {
            db.run('DELETE FROM book_fts_status WHERE book_id = ?', [bookId], () => resolve());
        });

        res.json({ message: 'Book removed from search index' });

    } catch (error) {
        console.error('[Search] Error removing from index:', error);
        res.status(500).json({ error: 'Failed to remove from index', message: error.message });
    }
});

/**
 * POST /api/search/init
 * Initialize FTS tables (admin only, typically called on startup)
 */
router.post('/init', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        await fullTextSearchService.initializeFTS();
        res.json({ message: 'Full-text search initialized' });
    } catch (error) {
        console.error('[Search] Error initializing FTS:', error);
        res.status(500).json({ error: 'Failed to initialize FTS', message: error.message });
    }
});

module.exports = router;