const Book = require('../models/Book');
const path = require('path');
const fs = require('fs').promises;

exports.getAllBooks = async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const books = await Book.findAll(parseInt(limit), parseInt(offset));
    const total = await Book.count();

    res.json({
      books,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: 'Error fetching books' });
  }
};

exports.getBookById = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json({ book });
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({ error: 'Error fetching book' });
  }
};

exports.searchBooks = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const books = await Book.search(q);
    res.json({ books, count: books.length });
  } catch (error) {
    console.error('Error searching books:', error);
    res.status(500).json({ error: 'Error searching books' });
  }
};

exports.uploadBook = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const bookData = {
      title: req.body.title || path.parse(req.file.originalname).name,
      author: req.body.author || 'Unknown',
      isbn: req.body.isbn || null,
      publisher: req.body.publisher || null,
      published_date: req.body.published_date || null,
      description: req.body.description || null,
      cover_image: req.body.cover_image || null,
      file_path: req.file.path,
      file_size: req.file.size,
      format: path.extname(req.file.originalname).substring(1).toLowerCase(),
      language: req.body.language || 'en',
      added_by: req.user.id
    };

    const book = await Book.create(bookData);

    res.status(201).json({
      message: 'Book uploaded successfully',
      book
    });
  } catch (error) {
    console.error('Error uploading book:', error);
    res.status(500).json({ error: 'Error uploading book' });
  }
};

exports.downloadBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const filePath = path.resolve(book.file_path);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({ error: 'Book file not found' });
    }

    res.download(filePath, `${book.title}.${book.format}`);
  } catch (error) {
    console.error('Error downloading book:', error);
    res.status(500).json({ error: 'Error downloading book' });
  }
};

exports.streamBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const filePath = path.resolve(book.file_path);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({ error: 'Book file not found' });
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Error streaming book:', error);
    res.status(500).json({ error: 'Error streaming book' });
  }
};

exports.deleteBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Delete file
    try {
      await fs.unlink(book.file_path);
    } catch (err) {
      console.error('Error deleting file:', err);
    }

    // Delete from database
    await Book.delete(req.params.id);

    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({ error: 'Error deleting book' });
  }
};

exports.getCoverImage = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book || !book.cover_image) {
      return res.status(404).json({ error: 'Cover image not found' });
    }

    const coverPath = path.resolve(book.cover_image);
    res.sendFile(coverPath);
  } catch (error) {
    console.error('Error fetching cover:', error);
    res.status(500).json({ error: 'Error fetching cover image' });
  }
};
