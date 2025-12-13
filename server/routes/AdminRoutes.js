const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const { db } = require('../database/init');

// All routes require admin
router.use(authMiddleware);
router.use(adminMiddleware);

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.getAll();
    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Delete a user
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const currentUserId = req.user.id;

    // Prevent self-deletion
    if (userId === currentUserId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user's reading progress first (foreign key constraint)
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM reading_progress WHERE user_id = ?', [userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Delete user's book requests
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM book_requests WHERE user_id = ?', [userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Delete the user
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Update user role
router.patch('/users/:id/role', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { role } = req.body;
    const currentUserId = req.user.id;

    // Validate role
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "user" or "admin"' });
    }

    // Prevent changing own role
    if (userId === currentUserId) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update role
    await new Promise((resolve, reject) => {
      db.run('UPDATE users SET role = ? WHERE id = ?', [role, userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: 'User role updated successfully', role });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

module.exports = router;
