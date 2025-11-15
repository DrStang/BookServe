const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bookController = require('../controllers/bookController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = process.env.BOOKS_STORAGE_PATH || './data/books';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.epub', '.pdf', '.mobi'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .epub, .pdf, and .mobi files are allowed'));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

// Get all books
router.get('/', authMiddleware, bookController.getAllBooks);

// Search books
router.get('/search', authMiddleware, bookController.searchBooks);

// Get book by ID
router.get('/:id', authMiddleware, bookController.getBookById);

// Upload book (admin only)
router.post('/', authMiddleware, adminMiddleware, upload.single('book'), bookController.uploadBook);

// Download book
router.get('/:id/download', authMiddleware, bookController.downloadBook);

// Stream book (for reading)
router.get('/:id/stream', authMiddleware, bookController.streamBook);

router.get('/:id/cover', authMiddleware, bookController.getCoverImage);

router.delete('/:id', authMiddleware, adminMiddleware, bookController.deleteBook);

router.put('/:id', authMiddleware, adminMiddleware, bookController.updateBook);

router.get('/:id/*', authMiddleware, bookController.streamBookContent);


module.exports = router;
