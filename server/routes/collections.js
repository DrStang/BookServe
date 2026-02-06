/**
 * Collections/Reading Lists Routes for BookServe
 *
 * Allows users to create and manage custom reading lists like:
 * - Want to Read
 * - Currently Reading
 * - Favorites
 * - Custom collections
 *
 * Usage: Add to server/index.js: app.use('/api/collections', collectionsRoutes);
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const Collection = require('../models/Collection');

/**
 * GET /api/collections
 * Get all collections for the current user
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const collections = await Collection.findByUserId(req.user.id);
        res.json({ collections });
    } catch (error) {
        console.error('[Collections] Error fetching collections:', error);
        res.status(500).json({ error: 'Failed to fetch collections' });
    }
});

/**
 * GET /api/collections/stats
 * Get collection statistics for the current user
 */
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const stats = await Collection.getStats(req.user.id);
        res.json(stats);
    } catch (error) {
        console.error('[Collections] Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

/**
 * GET /api/collections/:id
 * Get a single collection with its books
 */
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const collection = await Collection.findById(parseInt(req.params.id), req.user.id);

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        res.json({ collection });
    } catch (error) {
        console.error('[Collections] Error fetching collection:', error);
        res.status(500).json({ error: 'Failed to fetch collection' });
    }
});

/**
 * POST /api/collections
 * Create a new collection
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name, description, color, icon } = req.body;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Collection name is required' });
        }

        if (name.length > 100) {
            return res.status(400).json({ error: 'Collection name too long (max 100 characters)' });
        }

        const collection = await Collection.create({
            user_id: req.user.id,
            name: name.trim(),
            description: description?.trim() || null,
            color: color || '#6366f1',
            icon: icon || 'bookmark'
        });

        res.status(201).json({
            message: 'Collection created',
            collection
        });
    } catch (error) {
        if (error.message?.includes('UNIQUE constraint')) {
            return res.status(409).json({ error: 'A collection with this name already exists' });
        }
        console.error('[Collections] Error creating collection:', error);
        res.status(500).json({ error: 'Failed to create collection' });
    }
});

/**
 * PUT /api/collections/:id
 * Update a collection
 */
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { name, description, color, icon, sort_order } = req.body;

        if (name !== undefined && name.trim().length === 0) {
            return res.status(400).json({ error: 'Collection name cannot be empty' });
        }

        const result = await Collection.update(parseInt(req.params.id), req.user.id, {
            name: name?.trim(),
            description: description?.trim(),
            color,
            icon,
            sort_order
        });

        if (!result.updated) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        res.json({ message: 'Collection updated' });
    } catch (error) {
        if (error.message?.includes('UNIQUE constraint')) {
            return res.status(409).json({ error: 'A collection with this name already exists' });
        }
        console.error('[Collections] Error updating collection:', error);
        res.status(500).json({ error: 'Failed to update collection' });
    }
});

/**
 * DELETE /api/collections/:id
 * Delete a collection (cannot delete default collections)
 */
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const result = await Collection.delete(parseInt(req.params.id), req.user.id);

        if (!result.deleted) {
            return res.status(400).json({ error: result.message || 'Could not delete collection' });
        }

        res.json({ message: 'Collection deleted' });
    } catch (error) {
        console.error('[Collections] Error deleting collection:', error);
        res.status(500).json({ error: 'Failed to delete collection' });
    }
});

/**
 * POST /api/collections/:id/books
 * Add a book to a collection
 */
router.post('/:id/books', authMiddleware, async (req, res) => {
    try {
        const { bookId, notes } = req.body;

        if (!bookId) {
            return res.status(400).json({ error: 'Book ID is required' });
        }

        const result = await Collection.addBook(
            parseInt(req.params.id),
            parseInt(bookId),
            req.user.id,
            notes
        );

        res.json({ message: 'Book added to collection', ...result });
    } catch (error) {
        if (error.message === 'Collection not found') {
            return res.status(404).json({ error: 'Collection not found' });
        }
        if (error.message?.includes('UNIQUE constraint')) {
            return res.status(409).json({ error: 'Book is already in this collection' });
        }
        console.error('[Collections] Error adding book:', error);
        res.status(500).json({ error: 'Failed to add book to collection' });
    }
});

/**
 * DELETE /api/collections/:id/books/:bookId
 * Remove a book from a collection
 */
router.delete('/:id/books/:bookId', authMiddleware, async (req, res) => {
    try {
        const result = await Collection.removeBook(
            parseInt(req.params.id),
            parseInt(req.params.bookId),
            req.user.id
        );

        if (!result.removed) {
            return res.status(404).json({ error: 'Book not found in collection' });
        }

        res.json({ message: 'Book removed from collection' });
    } catch (error) {
        if (error.message === 'Collection not found') {
            return res.status(404).json({ error: 'Collection not found' });
        }
        console.error('[Collections] Error removing book:', error);
        res.status(500).json({ error: 'Failed to remove book from collection' });
    }
});

/**
 * PUT /api/collections/:id/books/:bookId
 * Update book notes in a collection
 */
router.put('/:id/books/:bookId', authMiddleware, async (req, res) => {
    try {
        const { notes } = req.body;

        const result = await Collection.updateBookNotes(
            parseInt(req.params.id),
            parseInt(req.params.bookId),
            req.user.id,
            notes
        );

        if (!result.updated) {
            return res.status(404).json({ error: 'Book not found in collection' });
        }

        res.json({ message: 'Notes updated' });
    } catch (error) {
        if (error.message === 'Collection not found') {
            return res.status(404).json({ error: 'Collection not found' });
        }
        console.error('[Collections] Error updating notes:', error);
        res.status(500).json({ error: 'Failed to update notes' });
    }
});

/**
 * POST /api/collections/:id/reorder
 * Reorder books in a collection
 */
router.post('/:id/reorder', authMiddleware, async (req, res) => {
    try {
        const { bookIds } = req.body;

        if (!Array.isArray(bookIds)) {
            return res.status(400).json({ error: 'bookIds must be an array' });
        }

        const result = await Collection.reorderBooks(
            parseInt(req.params.id),
            bookIds,
            req.user.id
        );

        res.json({ message: 'Books reordered', ...result });
    } catch (error) {
        if (error.message === 'Collection not found') {
            return res.status(404).json({ error: 'Collection not found' });
        }
        console.error('[Collections] Error reordering books:', error);
        res.status(500).json({ error: 'Failed to reorder books' });
    }
});

/**
 * POST /api/collections/move-book
 * Move a book from one collection to another
 */
router.post('/move-book', authMiddleware, async (req, res) => {
    try {
        const { bookId, fromCollectionId, toCollectionId } = req.body;

        if (!bookId || !fromCollectionId || !toCollectionId) {
            return res.status(400).json({ error: 'bookId, fromCollectionId, and toCollectionId are required' });
        }

        const result = await Collection.moveBook(
            parseInt(bookId),
            parseInt(fromCollectionId),
            parseInt(toCollectionId),
            req.user.id
        );

        res.json({ message: 'Book moved', ...result });
    } catch (error) {
        console.error('[Collections] Error moving book:', error);
        res.status(500).json({ error: 'Failed to move book' });
    }
});

/**
 * GET /api/collections/book/:bookId
 * Get all collections a book belongs to
 */
router.get('/book/:bookId', authMiddleware, async (req, res) => {
    try {
        const collections = await Collection.getBookCollections(
            parseInt(req.params.bookId),
            req.user.id
        );
        res.json({ collections });
    } catch (error) {
        console.error('[Collections] Error fetching book collections:', error);
        res.status(500).json({ error: 'Failed to fetch collections for book' });
    }
});

/**
 * POST /api/collections/init
 * Initialize default collections for the current user
 * Typically called after user registration or on first use
 */
router.post('/init', authMiddleware, async (req, res) => {
    try {
        await Collection.createDefaultCollections(req.user.id);
        const collections = await Collection.findByUserId(req.user.id);
        res.json({
            message: 'Default collections created',
            collections
        });
    } catch (error) {
        console.error('[Collections] Error initializing collections:', error);
        res.status(500).json({ error: 'Failed to initialize collections' });
    }
});

module.exports = router;