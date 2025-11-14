const express = require('express');
const router = express.Router();
const metadataController = require('../controllers/metadataController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Get metadata for external search (doesn't require book to exist)
router.get('/search', authMiddleware, metadataController.getMetadata);

// Search Google Books
router.get('/google-books/search', authMiddleware, metadataController.searchGoogleBooks);

// Search OpenLibrary
router.get('/openlibrary/search', authMiddleware, metadataController.searchOpenLibrary);

// Fetch/update metadata for a specific book
router.post('/books/:id/refresh', authMiddleware, metadataController.fetchBookMetadata);

// Batch update metadata (admin only)
router.post('/batch-update', authMiddleware, adminMiddleware, metadataController.batchUpdateMetadata);

// Update all books metadata (admin only)
router.post('/update-all', authMiddleware, adminMiddleware, metadataController.updateAllMetadata);

module.exports = router;
