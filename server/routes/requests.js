const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Search OpenLibrary
router.get('/search', authMiddleware, requestController.searchOpenLibrary);

// Create book request
router.post('/', authMiddleware, requestController.createRequest);

// Get user's requests
router.get('/my-requests', authMiddleware, requestController.getUserRequests);

// Get all requests (admin only)
router.get('/all', authMiddleware, adminMiddleware, requestController.getAllRequests);

// Get request by ID
router.get('/:id', authMiddleware, requestController.getRequestById);

module.exports = router;
