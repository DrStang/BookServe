const fs = require('fs').promises;
const path = require('path');
const Book = require('../models/Book');
const epubMetadataService = require('./epubMetadataService');
const seriesDetectionService = require('./seriesDetectionService');
const metadataService = require('./metadataService');
const crypto = require('crypto');
const aiCacheService = require('../services/aiCacheService');

class FolderScanService {
  constructor() {
    this.interval = null;
    this.scanInterval = parseInt(process.env.FOLDER_SCAN_INTERVAL) || 300000; // 5 minutes default
    this.booksPath = process.env.BOOKS_STORAGE_PATH || './data/books';
    this.isScanning = false;
    this.supportedFormats = ['.epub', '.pdf', '.mobi', '.azw', '.azw3'];

    this.lastScan = null;
    this.lastScanResults = {
      booksFound: 0,
      imported: 0,
      failed: 0
    };  
  }

  /**
   * Recursively scan a directory for book files
   * @param {string} dir - Directory to scan
   * @returns {Promise<string[]>} - Array of full file paths
   */
  async scanDirectoryRecursive(dir) {
    const bookFiles = [];

    try {
      const items = await fs.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
          // Recursively scan subdirectories
          const subFiles = await this.scanDirectoryRecursive(fullPath);
          bookFiles.push(...subFiles);
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          if (this.supportedFormats.includes(ext)) {
            bookFiles.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`Could not scan directory ${dir}:`, error.message);
    }

    return bookFiles;
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
        this.lastScan = new Date().toISOString();
        this.lastScanResults = { booksFound: 0, imported: 0, failed: 0 };
        return;
      }

      // Get all book files recursively (including subfolders)
      const bookFiles = await this.scanDirectoryRecursive(this.booksPath);

      if (bookFiles.length === 0) {
        console.log('No book files found in folder');
        this.isScanning = false;
        this.lastScan = new Date().toISOString();
        return;
      }

      console.log(`Found ${bookFiles.length} book file(s) in folder (including subfolders)`);

      // Get all existing books from database
      const existingBooks = await Book.findAll(10000, 0);
      const existingPaths = new Set(existingBooks.map(book => book.file_path));

      // Find new files (bookFiles already contains full paths)
      const newFiles = bookFiles.filter(filePath => !existingPaths.has(filePath));

      if (newFiles.length === 0) {
        console.log('No new books to import');
        this.isScanning = false;
        this.lastScan = new Date().toISOString();
        return;
      }

      console.log(`Found ${newFiles.length} new book(s) to import`);

      // Import each new file
      let imported = 0;
      let failed = 0;

      for (const filePath of newFiles) {
        try {
          await this.importBookFromPath(filePath);
          imported++;
        } catch (error) {
          console.error(`Failed to import ${filePath}:`, error.message);
          failed++;
        }
      }

      this.lastScanResults.imported = imported;
      this.lastScanResults.failed = failed;
      this.lastScan = new Date().toISOString();

      console.log(`Folder scan complete: ${imported} imported, ${failed} failed`);

    } catch (error) {
      console.error('Error during folder scan:', error);
      this.lastScan = new Date().toISOString();
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Import a single book file from full path
   * @param {string} filePath - Full path to the file to import
   */
  async importBookFromPath(filePath) {
    const filename = path.basename(filePath);
    const format = path.extname(filename).substring(1).toLowerCase();

    console.log(`Importing: ${filePath}`);

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

    if (!bookData.isbn && !bookData.isbn_13) {
      try {
        const BookRequest = require('../models/BookRequest');
        const matchingRequest = await BookRequest.findByTitleAuthor(bookData.title, bookData.author);
        if (matchingRequest?.isbn) {
          const reqIsbn = matchingRequest.isbn;
          if (reqIsbn.length === 13) {
              bookData.isbn_13 = reqIsbn;
          } else {
              bookData.isbn = reqIsbn;
          }
          console.log(`  ✓ ISBN backfilled from request: ${reqIsbn}`);
        }
      } catch (err) {
          console.warn(`  ⚠ Could not check requests for ISBN:`, err.message);
      }
    }  
    // Create book entry
    const book = await Book.create(bookData);
    console.log(`✓ Imported: ${bookData.title} (ID: ${book.id})`);

    aiCacheService.onBookAdded(book.id);

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
      supportedFormats: this.supportedFormats,
      lastScan: this.lastScan,
      booksFound: this.lastScanResults.booksFound,
      lastImported: this.lastScanResults.imported,
      lastFailed: this.lastScanResults.failed
    };
  }
}

module.exports = new FolderScanService();
