const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progressController');
const { authMiddleware } = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Get all progress for current user
router.get('/', progressController.getAllProgress);

// Get recently read books
router.get('/recently-read', progressController.getRecentlyRead);

// Get continue reading books
router.get('/continue-reading', progressController.getContinueReading);

// Get progress for a specific book
router.get('/:id', progressController.getBookProgress);

// Update progress for a specific book
router.post('/:id', progressController.updateBookProgress);

// Delete progress for a book
router.delete('/:id', progressController.deleteProgress);

module.exports = router;
