const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const goodreadsController = require('../controllers/goodreadsController');
const { authMiddleware } = require('../middleware/auth');

// Configure multer for CSV uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = process.env.TEMP_UPLOAD_PATH || './data/temp';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'goodreads-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv') {
      cb(new Error('Only CSV files are allowed'));
    } else {
      cb(null, true);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Preview CSV file (first 10 books)
router.post('/preview', authMiddleware, upload.single('csv'), goodreadsController.previewCSV);

// Import CSV file
router.post('/import', authMiddleware, upload.single('csv'), goodreadsController.importCSV);

// Get user's imported books
router.get('/imported-books', authMiddleware, goodreadsController.getImportedBooks);

module.exports = router;
