const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const nytBestsellersService = require('../services/nytBestsellersService');

/**
 * GET /api/nyt/status
 * Get NYT Bestsellers service status (admin only)
 */
router.get('/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const status = await nytBestsellersService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/nyt/trigger
 * Manually trigger a bestsellers check (admin only)
 */
router.post('/trigger', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await nytBestsellersService.triggerCheck();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/nyt/lists
 * Get available NYT bestseller lists (admin only)
 */
router.get('/lists', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const lists = await nytBestsellersService.getAvailableLists();
    res.json({ lists });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
