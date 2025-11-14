const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const { authMiddleware } = require('../middleware/auth');

// Send book by email
router.post('/:id/send', authMiddleware, emailController.sendBookByEmail);

// Test email configuration (admin only for security)
router.get('/test', emailController.testEmail);

module.exports = router;
