const Book = require('../models/Book');
const path = require('path');
const fs = require('fs').promises;
const epubMetadataService = require('../services/epubMetadataService');

exports.getAllBooks = async (req, res) => {
  try {
    const {
      limit = 100,
      offset = 0,
      sortBy = 'added_at',
      sortOrder = 'DESC',
      author,
      publisher,
      year,
      language,
      format,
      categories
    } = req.query;

    // Build filters object
    const filters = {};
    if (author) filters.author = author;
    if (publisher) filters.publisher = publisher;
    if (year) filters.year = year;
    if (language) filters.language = language;
    if (format) filters.format = format;
    if (categories) filters.categories = categories;

    const books = await Book.findAll(
      parseInt(limit),
      parseInt(offset),
      sortBy,
      sortOrder,
      filters
    );
    const total = await Book.count(filters);

    res.json({
      books,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      sortBy,
      sortOrder,
      filters
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

    const format = path.extname(req.file.originalname).substring(1).toLowerCase();

    // Extract metadata from EPUB file if it's an EPUB
    let extractedMetadata = {};
    if (format === 'epub') {
      extractedMetadata = epubMetadataService.extractMetadata(req.file.path);
    }

    // Use extracted metadata as fallback, but allow manual overrides from request body
    const bookData = {
      title: req.body.title || extractedMetadata.title || path.parse(req.file.originalname).name,
      author: req.body.author || extractedMetadata.author || 'Unknown',
      isbn: req.body.isbn || extractedMetadata.isbn || null,
      isbn_13: req.body.isbn_13 || extractedMetadata.isbn_13 || null,
      publisher: req.body.publisher || extractedMetadata.publisher || null,
      published_date: req.body.published_date || extractedMetadata.published_date || null,
      description: req.body.description || extractedMetadata.description || null,
      cover_image: req.body.cover_image || null,
      file_path: req.file.path,
      file_size: req.file.size,
      format: format,
      language: req.body.language || extractedMetadata.language || 'en',
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

// Set proper headers for EPUB

    res.setHeader('Content-Type', 'application/epub+zip');

    res.setHeader('Accept-Ranges', 'bytes');

    res.sendFile(filePath);

  } catch (error) {

    console.error('Error streaming book:', error);

    res.status(500).json({ error: 'Error streaming book' });

  }

};

 

// Serve EPUB content files (for EPUBjs reader)

exports.streamBookContent = async (req, res) => {

  try {

    const { id } = req.params;

    const contentPath = req.params[0]; // Capture the rest of the path

 

    const book = await Book.findById(id);

 

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

 

    // For EPUB files, we need to extract and serve individual files

    if (contentPath) {

      const AdmZip = require('adm-zip');

      const zip = new AdmZip(filePath);

      const zipEntry = zip.getEntry(contentPath);

 

      if (!zipEntry) {

        return res.status(404).json({ error: 'Content not found in EPUB' });

      }

 

      const content = zip.readFile(zipEntry);

 

      // Set appropriate content type based on file extension

      const ext = path.extname(contentPath).toLowerCase();

      const contentTypes = {

        '.xml': 'application/xml',

        '.xhtml': 'application/xhtml+xml',

        '.html': 'text/html',

        '.css': 'text/css',

        '.js': 'application/javascript',

        '.jpg': 'image/jpeg',

        '.jpeg': 'image/jpeg',

        '.png': 'image/png',

        '.gif': 'image/gif',

        '.svg': 'image/svg+xml',

        '.otf': 'font/otf',

        '.ttf': 'font/ttf',

        '.woff': 'font/woff',

        '.woff2': 'font/woff2'

      };

 

      res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');

      res.send(content);

    } else {

      // No content path - serve the whole EPUB

      res.setHeader('Content-Type', 'application/epub+zip');

      res.sendFile(filePath);

    }

  } catch (error) {

    console.error('Error streaming book content:', error);

    res.status(500).json({ error: 'Error streaming book content' });
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

// Check if cover_image is a URL or local path

    if (book.cover_image.startsWith('http://') || book.cover_image.startsWith('https://')) {

      // Proxy the external image

      const axios = require('axios');

      const response = await axios.get(book.cover_image, { responseType: 'arraybuffer' });

      res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');

      res.send(response.data);

    } else {

      // Serve local file

      const coverPath = path.resolve(book.cover_image);

      res.sendFile(coverPath);

    }

  } catch (error) {

    console.error('Error fetching cover:', error);

    res.status(500).json({ error: 'Error fetching cover image' });

  }

};

 

// Update book

exports.updateBook = async (req, res) => {

  try {

    const book = await Book.findById(req.params.id);

 

    if (!book) {

      return res.status(404).json({ error: 'Book not found' });

    }

 

    // Update allowed fields

    const allowedFields = [

      'title', 'author', 'isbn', 'isbn_13', 'publisher', 'published_date',

      'description', 'cover_image', 'language', 'page_count', 'categories'

    ];

 

    const updates = {};

    Object.keys(req.body).forEach(key => {

      if (allowedFields.includes(key)) {

        updates[key] = req.body[key];

      }

    });

 

    await Book.update(req.params.id, updates);

    const updatedBook = await Book.findById(req.params.id);

 

    res.json({

      message: 'Book updated successfully',

      book: updatedBook

    });

  } catch (error) {

    console.error('Error updating book:', error);

    res.status(500).json({ error: 'Error updating book' });
  }
};
