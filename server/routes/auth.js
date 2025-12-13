const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

// Register
router.post(
  '/register',
  [
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  authController.register
);

// Login
router.post('/login', authController.login);

// Get profile (protected)
router.get('/profile', authMiddleware, authController.getProfile);

// Change password (protected)
router.post('/change-password', authMiddleware, authController.changePassword);

module.exports = router;
