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
      // Get the download path from SABnzbd
      const downloadPath = historySlot.storage;

      // Find epub files in the directory
      const files = await fs.readdir(downloadPath);
      const epubFile = files.find(f => f.toLowerCase().endsWith('.epub'));

      if (!epubFile) {
        await BookRequest.updateStatus(request.id, 'failed', {
          error_message: 'No EPUB file found in download'
        });
        return;
      }

      const sourcePath = path.join(downloadPath, epubFile);
      const destPath = path.join(
        process.env.BOOKS_STORAGE_PATH || './data/books',
        `${Date.now()}-${epubFile}`
      );

      // Copy file to books directory
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
        added_by: 1 // System user
      };

      const book = await Book.create(bookData);

      // Update request status
      await BookRequest.updateStatus(request.id, 'completed');

      console.log(`Successfully imported book: ${request.title}`);
    } catch (error) {
      console.error('Error importing book:', error);
      await BookRequest.updateStatus(request.id, 'failed', {
        error_message: error.message
      });
    }
  }
}

module.exports = new DownloadMonitor();
