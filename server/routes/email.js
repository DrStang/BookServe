const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const { authMiddleware } = require('../middleware/auth');

// Send book by email
router.post('/:id/send', authMiddleware, emailController.sendBookByEmail);

router.get('/saved-email', authMiddleware, emailController.getSavedEmail);

router.post('/saved-email', authMiddleware, emailController.saveEmail);

router.delete('/saved-email', authMiddleware, emailController.clearSavedEmail);

// Test email configuration (admin only for security)
router.get('/test', emailController.testEmail);

module.exports = router;
