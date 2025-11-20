const BookRequest = require('../models/BookRequest');
const axios = require('axios');
const FormData = require('form-data');

class RetryService {
  constructor() {
    this.interval = null;
    // Default to 6 hours (every 6 hours)
    this.checkInterval = parseInt(process.env.RETRY_CHECK_INTERVAL) || 21600000;
    // Default to retry every 3 days
    this.retryIntervalDays = parseInt(process.env.RETRY_INTERVAL_DAYS) || 3;
  }

  start() {
    if (!process.env.RETRY_ENABLED || process.env.RETRY_ENABLED !== 'true') {
      console.log('Book search retry service disabled');
      return;
    }

    console.log(`Starting book search retry service (checking every ${this.checkInterval / 1000 / 60}m)`);
    this.interval = setInterval(() => this.checkFailedRequests(), this.checkInterval);

    // Run an initial check shortly after startup
    setTimeout(() => this.checkFailedRequests(), 60000); // 1 minute after startup
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async checkFailedRequests() {
    try {
      console.log('Checking for failed book requests to retry...');
      const failedRequests = await BookRequest.getFailedRequestsForRetry();

      if (failedRequests.length === 0) {
        console.log('No failed requests found for retry');
        return;
      }

      console.log(`Found ${failedRequests.length} failed request(s) to retry`);

      for (const request of failedRequests) {
        await this.retryBookSearch(request);
      }
    } catch (error) {
      console.error('Error in retry service:', error);
    }
  }

  async retryBookSearch(request) {
    try {
      console.log(`Retrying search for: ${request.title} by ${request.author} (Attempt ${request.retry_count + 1}/${request.max_retries})`);

      // Increment retry count
      await BookRequest.incrementRetryCount(request.id);

      // Search NZBHydra
      const searchResults = await this.searchNZBHydra(request.title, request.author);

      if (!searchResults || searchResults.length === 0) {
        console.log(`No results found for: ${request.title} (will retry later)`);
        // Schedule next retry
        await BookRequest.scheduleRetry(request.id, this.retryIntervalDays);
        return;
      }

      console.log(`Found ${searchResults.length} result(s) for: ${request.title}`);

      // Get the best result (already sorted by relevance)
      const bestResult = searchResults[0];

      // Update status to searching
      await BookRequest.updateStatus(request.id, 'searching', {
        nzb_search_id: bestResult.guid
      });

      // Send to SABnzbd
      const sabnzbdResult = await this.sendToSABnzbd(bestResult.link, bestResult.title);

      if (sabnzbdResult.success) {
        console.log(`Successfully queued download for: ${request.title}`);

        // Update status to downloading and reset retry status
        await BookRequest.updateStatus(request.id, 'downloading', {
          sabnzbd_id: sabnzbdResult.nzo_id,
          error_message: null
        });
        await BookRequest.resetRetryStatus(request.id);

        // Send notification to user
        await this.notifyUser(request, bestResult);
      } else {
        console.log(`Failed to send to SABnzbd: ${request.title}`);
        await BookRequest.updateStatus(request.id, 'failed', {
          error_message: 'Failed to send to SABnzbd: ' + (sabnzbdResult.error || 'Unknown error')
        });
        // Schedule next retry
        await BookRequest.scheduleRetry(request.id, this.retryIntervalDays);
      }

    } catch (error) {
      console.error(`Error retrying book search for ${request.title}:`, error);
      // Schedule next retry
      await BookRequest.scheduleRetry(request.id, this.retryIntervalDays);
    }
  }

  async searchNZBHydra(title, author) {
    try {
      const nzbhydraUrl = process.env.NZBHYDRA_URL;
      const apiKey = process.env.NZBHYDRA_API_KEY;

      if (!nzbhydraUrl || !apiKey) {
        throw new Error('NZBHydra URL or API key not configured');
      }

      // Build search query: "title author epub"
      const searchQuery = `${title}${author ? ' ' + author : ''} epub`;

      const response = await axios.get(`${nzbhydraUrl}/api`, {
        params: {
          apikey: apiKey,
          t: 'search',
          q: searchQuery,
          cat: '7020', // eBooks category
          extended: '1',
          offset: '0',
          limit: '100'
        },
        timeout: 30000
      });

      if (!response.data) {
        return [];
      }

      // Parse XML response
      const xml2js = require('xml2js');
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(response.data);

      if (!result.rss || !result.rss.channel || !result.rss.channel.item) {
        return [];
      }

      // Ensure items is an array
      const items = Array.isArray(result.rss.channel.item)
        ? result.rss.channel.item
        : [result.rss.channel.item];

      // Calculate relevance scores
      const scoredResults = items.map(item => {
        let score = 0;
        const itemTitle = (item.title || '').toLowerCase();
        const searchTitle = title.toLowerCase();

        // Exact title match
        if (itemTitle.includes(searchTitle)) {
          score += 100;
        }

        // All title words present
        const titleWords = searchTitle.split(/\s+/);
        if (titleWords.every(word => itemTitle.includes(word))) {
          score += 50;
        }

        // Author match
        if (author && itemTitle.includes(author.toLowerCase())) {
          score += 50;
        }

        // EPUB format preference
        if (itemTitle.includes('epub')) {
          score += 10;
        }

        // Title appears early in result
        const titleIndex = itemTitle.indexOf(searchTitle);
        if (titleIndex >= 0 && titleIndex < 10) {
          score += 20;
        }

        // Penalize very long titles (likely bundles)
        if (itemTitle.length > 200) {
          score -= 20;
        }

        return {
          title: item.title,
          link: item.link || item.guid,
          guid: item.guid,
          pubDate: item.pubDate,
          size: item['newznab:attr']?.find(attr => attr.$.name === 'size')?.$.value,
          score: score
        };
      });

      // Sort by score (highest first)
      scoredResults.sort((a, b) => b.score - a.score);

      return scoredResults;
    } catch (error) {
      console.error('Error searching NZBHydra:', error.message);
      return [];
    }
  }

  async sendToSABnzbd(nzbUrl, name) {
    try {
      const sabnzbdUrl = process.env.SABNZBD_URL;
      const apiKey = process.env.SABNZBD_API_KEY;

      if (!sabnzbdUrl || !apiKey) {
        throw new Error('SABnzbd URL or API key not configured');
      }

      // Download the NZB file
      const nzbResponse = await axios.get(nzbUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      // Prepare form data
      const form = new FormData();
      form.append('name', Buffer.from(nzbResponse.data), {
        filename: `${name}.nzb`,
        contentType: 'application/x-nzb'
      });
      form.append('cat', 'books');
      form.append('priority', '0');

      // Send to SABnzbd
      const response = await axios.post(
        `${sabnzbdUrl}/api`,
        form,
        {
          params: {
            apikey: apiKey,
            mode: 'addfile',
            output: 'json'
          },
          headers: form.getHeaders(),
          timeout: 30000
        }
      );

      if (response.data && response.data.status && response.data.nzo_ids) {
        return {
          success: true,
          nzo_id: response.data.nzo_ids[0]
        };
      } else {
        return {
          success: false,
          error: response.data?.error || 'Unknown error from SABnzbd'
        };
      }
    } catch (error) {
      console.error('Error sending to SABnzbd:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async notifyUser(request, searchResult) {
    try {
      // Only send notification if user has email notifications enabled
      if (request.email_notifications === 0) {
        console.log(`User ${request.username} has email notifications disabled`);
        return;
      }

      // Check if email is configured
      if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
        console.log('Email not configured, skipping notification');
        return;
      }

      const emailController = require('../controllers/emailController');

      const subject = `Book Found: ${request.title}`;
      const text = `Good news! We found your requested book and started downloading it.

Book: ${request.title}
Author: ${request.author || 'Unknown'}
Status: Download started

The book will be available in your library once the download completes.

This is retry attempt ${request.retry_count} after the initial search failed.

---
BookServe - Your Personal Book Library`;

      const html = `
        <h2>Good news! We found your requested book</h2>
        <p>The book you requested is now being downloaded:</p>
        <ul>
          <li><strong>Title:</strong> ${request.title}</li>
          <li><strong>Author:</strong> ${request.author || 'Unknown'}</li>
          <li><strong>Status:</strong> Download started</li>
        </ul>
        <p>The book will be available in your library once the download completes.</p>
        <p><em>This is retry attempt ${request.retry_count} after the initial search failed.</em></p>
        <hr>
        <p style="color: #666; font-size: 12px;">BookServe - Your Personal Book Library</p>
      `;

      await emailController.sendNotificationEmail(request.email, subject, text, html);
      console.log(`Notification sent to ${request.email} for book: ${request.title}`);
    } catch (error) {
      console.error('Error sending notification:', error.message);
      // Don't throw - notification failure shouldn't stop the retry process
    }
  }
}

module.exports = new RetryService();
