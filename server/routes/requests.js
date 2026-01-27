const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Search OpenLibrary
router.get('/search', authMiddleware, requestController.searchOpenLibrary);

router.get('/stats', authMiddleware, adminMiddleware, requestController.getRequestStats);

// Get search failure statistics (admin only) - helps identify problem patterns
router.get('/search-failures', authMiddleware, adminMiddleware, requestController.getSearchFailureStats);

// Create book request
router.post('/', authMiddleware, requestController.createRequest);

// Get user's requests
router.get('/my-requests', authMiddleware, requestController.getUserRequests);

// Get all requests (admin only)
router.get('/all', authMiddleware, adminMiddleware, requestController.getAllRequests);

// Manual retry with custom search terms (owner or admin)
router.post('/:id/retry', authMiddleware, requestController.retryWithCustomSearch);

// Get request by ID
router.get('/:id', authMiddleware, requestController.getRequestById);

router.delete('/:id', authMiddleware, requestController.deleteRequest);

router.post('/:id/fulfill', authMiddleware, adminMiddleware, requestController.markAsFulfilled);

module.exports = router;
