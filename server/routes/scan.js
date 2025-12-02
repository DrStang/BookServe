const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const folderScanService = require('../services/folderScanService');

/**
 * GET /api/scan/status
 * Get folder scan service status
 */
router.get('/status', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const status = folderScanService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/scan/trigger
 * Manually trigger a folder scan
 */
router.post('/trigger', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await folderScanService.triggerScan();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
