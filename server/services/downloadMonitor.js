const axios = require('axios');
const BookRequest = require('../models/BookRequest');
const Book = require('../models/Book');
const fs = require('fs').promises;
const path = require('path');

class DownloadMonitor {
  constructor() {
    this.interval = null;
    this.checkInterval = parseInt(process.env.AUTO_IMPORT_INTERVAL) || 300000; // 5 minutes
  }

  start() {
    if (!process.env.AUTO_IMPORT_ENABLED || process.env.AUTO_IMPORT_ENABLED !== 'true') {
      console.log('Auto-import disabled');
      return;
    }

    console.log(`Starting download monitor (checking every ${this.checkInterval / 1000}s)`);
    this.interval = setInterval(() => this.checkDownloads(), this.checkInterval);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async checkDownloads() {
    try {
      const pendingRequests = await BookRequest.getPendingRequests();

      for (const request of pendingRequests) {
        if (request.status === 'downloading' && request.sabnzbd_id) {
          await this.checkSABnzbdStatus(request);
        }
      }
    } catch (error) {
      console.error('Error in download monitor:', error);
    }
  }

  async checkSABnzbdStatus(request) {
    try {
      const sabnzbdUrl = process.env.SABNZBD_URL;
      const apiKey = process.env.SABNZBD_API_KEY;

      if (!sabnzbdUrl || !apiKey) {
        return;
      }

      // Get queue status
      const response = await axios.get(`${sabnzbdUrl}/api`, {
        params: {
          apikey: apiKey,
          mode: 'queue',
          output: 'json'
        }
      });

      const queue = response.data.queue;
      const slot = queue.slots?.find(s => s.nzo_id === request.sabnzbd_id);

      // Check if download is complete (not in queue anymore)
      if (!slot) {
        // Check history
        const historyResponse = await axios.get(`${sabnzbdUrl}/api`, {
          params: {
            apikey: apiKey,
            mode: 'history',
            output: 'json'
          }
        });

        const historySlot = historyResponse.data.history.slots?.find(
          s => s.nzo_id === request.sabnzbd_id
        );

        if (historySlot && historySlot.status === 'Completed') {
          await this.importCompletedBook(request, historySlot);
        } else if (historySlot && historySlot.status === 'Failed') {
          await BookRequest.updateStatus(request.id, 'failed', {
            error_message: 'Download failed in SABnzbd'
          });
        }
      }
    } catch (error) {
      console.error('Error checking SABnzbd status:', error);
    }
  }

  async importCompletedBook(request, historySlot) {
    try {
      // Get the download path from SABnzbd history
      let downloadPath = historySlot.storage;
      
      console.log('SABnzbd reported storage path:', downloadPath);

      // If the path doesn't exist, try to construct it from env variable
      if (!downloadPath || !(await fs.access(downloadPath).then(() => true).catch(() => false))) {
        // Use the configured download path from environment
        const configuredDownloadPath = process.env.SABNZBD_DOWNLOAD_PATH || process.env.BOOKS_STORAGE_PATH || './data/books';
        
        // Get the folder name from the history slot
        const folderName = historySlot.name || historySlot.nzo_id;
        downloadPath = path.join(configuredDownloadPath, folderName);
        
        console.log('Constructed download path:', downloadPath);
      }

      // Check if directory exists
      try {
        await fs.access(downloadPath);
      } catch (err) {
        console.error('Download directory not found:', downloadPath);
        await BookRequest.updateStatus(request.id, 'failed', {
          error_message: `Download directory not found: ${downloadPath}`
        });
        return;
      }

      // Find epub files in the directory
      const files = await fs.readdir(downloadPath);
      console.log('Files in download directory:', files);
      
      const epubFile = files.find(f => f.toLowerCase().endsWith('.epub'));

      if (!epubFile) {
        console.error('No EPUB file found in download');
        await BookRequest.updateStatus(request.id, 'failed', {
          error_message: 'No EPUB file found in download'
        });
        return;
      }

      const sourcePath = path.join(downloadPath, epubFile);
      console.log('Found EPUB file:', sourcePath);

      // Check if source file exists
      try {
        await fs.access(sourcePath);
      } catch (err) {
        console.error('EPUB file not accessible:', sourcePath);
        await BookRequest.updateStatus(request.id, 'failed', {
          error_message: `EPUB file not accessible: ${sourcePath}`
        });
        return;
      }

      const destPath = path.join(
        process.env.BOOKS_STORAGE_PATH || './data/books',
        `${Date.now()}-${epubFile}`
      );

      // Copy file to books directory
      console.log('Copying from:', sourcePath);
      console.log('Copying to:', destPath);
      await fs.copyFile(sourcePath, destPath);

      const stats = await fs.stat(destPath);

      // Create book entry
      const bookData = {
        title: request.title,
        author: request.author || 'Unknown',
        isbn: request.isbn,
        file_path: destPath,
        file_size: stats.size,
        format: 'epub',
        added_by: request.user_id || 1
      };

      const book = await Book.create(bookData);

      console.log(`Successfully imported book: ${request.title} (ID: ${book.id})`);

      // Fetch metadata in background (don't wait for it)
      const metadataService = require('./metadataService');
      metadataService.updateBookMetadata(book.id, false)
        .then(() => {
          console.log(`Metadata fetched for: ${request.title}`);
        })
        .catch(err => {
          console.error(`Failed to fetch metadata for ${request.title}:`, err.message);
        });

      // Update request status
      await BookRequest.updateStatus(request.id, 'completed');

      // Optional: Clean up the download directory
      if (process.env.DELETE_AFTER_IMPORT === 'true') {
        try {
          await fs.rm(downloadPath, { recursive: true, force: true });
          console.log('Cleaned up download directory');
        } catch (err) {
          console.error('Failed to clean up download directory:', err.message);
        }
      }

    } catch (error) {
      console.error('Error importing book:', error);
      await BookRequest.updateStatus(request.id, 'failed', {
        error_message: error.message
      });
    }
  }
}

module.exports = new DownloadMonitor();
