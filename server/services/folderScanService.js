const fs = require('fs').promises;
const path = require('path');
const Book = require('../models/Book');
const epubMetadataService = require('./epubMetadataService');
const seriesDetectionService = require('./seriesDetectionService');
const metadataService = require('./metadataService');
const crypto = require('crypto');

class FolderScanService {
  constructor() {
    this.interval = null;
    this.scanInterval = parseInt(process.env.FOLDER_SCAN_INTERVAL) || 300000; // 5 minutes default
    this.booksPath = process.env.BOOKS_STORAGE_PATH || './data/books';
    this.isScanning = false;
    this.supportedFormats = ['.epub', '.pdf', '.mobi', '.azw', '.azw3'];
  }

  start() {
    if (!process.env.FOLDER_SCAN_ENABLED || process.env.FOLDER_SCAN_ENABLED !== 'true') {
      console.log('Folder scanning disabled');
      return;
    }

    console.log(`Starting folder scan service (checking every ${this.scanInterval / 1000}s)`);
    
    // Run initial scan after a short delay
    setTimeout(() => this.scanFolder(), 5000);
    
    // Set up periodic scanning
    this.interval = setInterval(() => this.scanFolder(), this.scanInterval);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Scan the books folder for new files
   */
  async scanFolder() {
    if (this.isScanning) {
      console.log('Scan already in progress, skipping...');
      return;
    }

    try {
      this.isScanning = true;
      console.log('Starting folder scan...');

      // Ensure books directory exists
      try {
        await fs.access(this.booksPath);
      } catch (error) {
        console.log('Books directory does not exist, creating it...');
        await fs.mkdir(this.booksPath, { recursive: true });
        this.isScanning = false;
        return;
      }

      // Get all files in the directory
      const files = await fs.readdir(this.booksPath);
      
      // Filter for supported book formats
      const bookFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return this.supportedFormats.includes(ext);
      });

      if (bookFiles.length === 0) {
        console.log('No book files found in folder');
        this.isScanning = false;
        return;
      }

      console.log(`Found ${bookFiles.length} book file(s) in folder`);

      // Get all existing books from database
      const existingBooks = await Book.findAll(10000, 0);
      const existingPaths = new Set(existingBooks.map(book => book.file_path));

      // Find new files
      const newFiles = bookFiles.filter(file => {
        const fullPath = path.join(this.booksPath, file);
        return !existingPaths.has(fullPath);
      });

      if (newFiles.length === 0) {
        console.log('No new books to import');
        this.isScanning = false;
        return;
      }

      console.log(`Found ${newFiles.length} new book(s) to import`);

      // Import each new file
      let imported = 0;
      let failed = 0;

      for (const file of newFiles) {
        try {
          await this.importBook(file);
          imported++;
        } catch (error) {
          console.error(`Failed to import ${file}:`, error.message);
          failed++;
        }
      }

      console.log(`Folder scan complete: ${imported} imported, ${failed} failed`);

    } catch (error) {
      console.error('Error during folder scan:', error);
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Import a single book file
   * @param {string} filename - Name of the file to import
   */
  async importBook(filename) {
    const filePath = path.join(this.booksPath, filename);
    const format = path.extname(filename).substring(1).toLowerCase();

    console.log(`Importing: ${filename}`);

    // Get file stats
    const stats = await fs.stat(filePath);

    // Extract metadata if EPUB
    let extractedMetadata = {};
    if (format === 'epub') {
      try {
        extractedMetadata = epubMetadataService.extractMetadata(filePath);
      } catch (error) {
        console.warn(`Could not extract EPUB metadata from ${filename}:`, error.message);
      }
    }

    // Determine title from metadata or filename
    const rawTitle = extractedMetadata.title || path.parse(filename).name;
    
    // Detect series information
    const seriesInfo = seriesDetectionService.detectSeries(rawTitle, extractedMetadata);

    // Prepare book data
    const bookData = {
      title: seriesInfo.cleanTitle || rawTitle,
      author: extractedMetadata.author || 'Unknown',
      isbn: extractedMetadata.isbn || null,
      isbn_13: extractedMetadata.isbn_13 || null,
      publisher: extractedMetadata.publisher || null,
      published_date: extractedMetadata.published_date || null,
      description: extractedMetadata.description || null,
      cover_image: null,
      file_path: filePath,
      file_size: stats.size,
      format: format,
      language: extractedMetadata.language || 'en',
      series: seriesInfo.series || null,
      series_number: seriesInfo.seriesNumber || null,
      added_by: 1 // Default to admin user (ID 1)
    };

    // Create book entry
    const book = await Book.create(bookData);
    console.log(`✓ Imported: ${bookData.title} (ID: ${book.id})`);

    // Fetch metadata in background (don't block the import)
    if (process.env.AUTO_FETCH_METADATA !== 'false') {
      this.fetchMetadataAsync(book.id, bookData.title);
    }

    return book;
  }

  /**
   * Fetch metadata asynchronously without blocking
   * @param {number} bookId - Book ID
   * @param {string} title - Book title for logging
   */
  async fetchMetadataAsync(bookId, title) {
    try {
      // Add a small delay to avoid overwhelming the metadata APIs
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await metadataService.updateBookMetadata(bookId, false);
      console.log(`  ✓ Metadata fetched for: ${title}`);
    } catch (error) {
      console.warn(`  ✗ Failed to fetch metadata for ${title}:`, error.message);
    }
  }

  /**
   * Manual trigger for folder scan (can be called from API)
   */
  async triggerScan() {
    if (this.isScanning) {
      return { status: 'already_scanning' };
    }

    console.log('Manual folder scan triggered');
    await this.scanFolder();
    return { status: 'completed' };
  }

  /**
   * Get scan service status
   */
  getStatus() {
    return {
      enabled: process.env.FOLDER_SCAN_ENABLED === 'true',
      isScanning: this.isScanning,
      scanInterval: this.scanInterval,
      booksPath: this.booksPath,
      supportedFormats: this.supportedFormats
    };
  }
}

module.exports = new FolderScanService();
