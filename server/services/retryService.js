const BookRequest = require('../models/BookRequest');
const { searchNZBHydra } = require('../controllers/requestController');
const axios = require('axios');
const FormData = require('form-data');
const { getAABook } = require ('../controllers/requestController');
const { getOcean } = require ('../controllers/requestController');

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
            console.log('[Retry] Checking for failed book requests to retry...');
            const failedRequests = await BookRequest.getFailedRequestsForRetry();

            if (failedRequests.length === 0) {
                console.log('[Retry] No failed requests found for retry');
                return;
            }

            console.log(`[Retry] Found ${failedRequests.length} failed request(s) to retry`);

            for (const request of failedRequests) {
                await this.retryBookSearch(request);
                // Add delay between retries to avoid overwhelming services
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        } catch (error) {
            console.error('[Retry] Error in retry service:', error);
        }
    }

    async retryBookSearch(request) {
        try {
            console.log(`[Retry] Retrying search for: "${request.title}" by ${request.author} (Attempt ${request.retry_count + 1}/${request.max_retries})`);

            // Increment retry count
            await BookRequest.incrementRetryCount(request.id);

            try {
                const anna = await getAABook(request.isbn, request.title, request.author);
                if (anna) {
                    console.log(`[Retry - AA] Updating status to completed for request ${request.id}`);
                    await BookRequest.updateStatus(request.id, 'completed');
                    await BookRequest.resetRetryStatus(request.id);
                    await this.notifyUser(request )
                    return anna;
                }
            } catch (err) {
                    console.error('[Retry - AA] AA failed', err.message);

            }
            try {
                const ocean = await getOcean(request.title, request.author, request.isbn);
                if (ocean) {
                    console.log(`[Retry - Ocean] Updating status to completed for request ${request.id}`);
                    await BookRequest.updateStatus(request.id, 'completed');
                    await BookRequest.resetRetryStatus(request.id);
                    await this.notifyUser(request )
                    return ocean;
                }
            } catch (err) {
                console.error('[Retry - Ocean] Ocean failed', err.message);
            }

            try {
                const nzb = await searchNZBHydra(request.title, request.author, request.isbn, request.id);
                if (!nzb || nzb.length === 0) {
                    console.log(`[Retry] No results found for: "${request.title}" (will retry later)`);
                    // Schedule next retry
                    await BookRequest.scheduleRetry(request.id, this.retryIntervalDays);
                    return;
                }
                console.log(`[Retry] Found ${nzb.length} result(s) for: "${request.title}"`);

                // Get the best result (already sorted by relevance)
                const bestResult = nzb[0];
                console.log(`[Retry] Best match: "${bestResult.title}" (score: ${bestResult.relevanceScore})`);

                // Update status to searching
                await BookRequest.updateStatus(request.id, 'searching', {
                    nzb_search_id: bestResult.guid
                });

                // Send to SABnzbd
                const sabnzbdResult = await this.sendToSABnzbd(bestResult);

                if (sabnzbdResult.success) {
                    console.log(`[Retry] ✓ Successfully queued download for: "${request.title}"`);

                    // Update status to downloading and reset retry status
                    await BookRequest.updateStatus(request.id, 'downloading', {
                        sabnzbd_id: sabnzbdResult.nzo_id,
                        error_message: null
                    });
                    await BookRequest.resetRetryStatus(request.id);
                    await this.notifyUser(request )
                } else {
                    console.log(`[Retry] ✗ Failed to send to SABnzbd: "${request.title}"`);
                    await BookRequest.updateStatus(request.id, 'failed', {
                        error_message: 'Failed to send to SABnzbd: ' + (sabnzbdResult.error || 'Unknown error')
                    });
                    // Schedule next retry
                    await BookRequest.scheduleRetry(request.id, this.retryIntervalDays);
                }
            } catch (error) {
                console.error(`[Retry -NZB] Error retrying book search for "${request.title}":`, error);
                // Schedule next retry
            }


        } catch (error) {
            console.error(`[Retry] Error retrying book search for "${request.title}":`, error);
            // Schedule next retry
            await BookRequest.scheduleRetry(request.id, this.retryIntervalDays);
        }
    }

    async sendToSABnzbd(nzbResult) {
        try {
            const sabnzbdUrl = process.env.SABNZBD_URL;
            const apiKey = process.env.SABNZBD_API_KEY;
            const nzbhydraApiKey = process.env.NZBHYDRA_API_KEY;
            const nzbhydraUrl = process.env.NZBHYDRA_URL;

            if (!sabnzbdUrl || !apiKey) {
                throw new Error('SABnzbd URL or API key not configured');
            }

            let nzbLink = nzbResult.link;

            // Add NZBHydra API key if needed
            if (nzbLink.includes(nzbhydraUrl) && !nzbLink.includes('apikey=')) {
                nzbLink += (nzbLink.includes('?') ? '&' : '?') + `apikey=${nzbhydraApiKey}`;
            }

            // Download the NZB file
            const nzbResponse = await axios.get(nzbLink, {
                responseType: 'arraybuffer',
                timeout: 30000
            });

            // Prepare form data
            const form = new FormData();
            const fileName = `${nzbResult.title.replace(/[^a-z0-9]/gi, '_')}.nzb`;
            form.append('name', Buffer.from(nzbResponse.data), {
                filename: fileName,
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
            console.error('[Retry] Error sending to SABnzbd:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async notifyUser(request) {
        try {
            // Only send notification if user has email notifications enabled
            if (request.email_notifications === 0) {
                console.log(`[Retry] User ${request.username} has email notifications disabled`);
                return;
            }

            // Check if email is configured
            if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
                console.log('[Retry] Email not configured, skipping notification');
                return;
            }

            const emailController = require('../controllers/emailController');

            const subject = `Book Found: ${request.title}`;
            const text = `Good news! We found your requested book and started downloading it.

Book: ${request.title}
Author: ${request.author || 'Unknown'}
Match: ${searchResult.title}
Status: Download started

The book will be available in your library once the download completes.

This is retry attempt ${request.retry_count} after the initial search failed.

---
BookServe - Your Personal Book Library`;

            const html = `
        <h2>Good news! We found your requested book</h2>
        <p>The book you requested is now being downloaded:</p>
        <table style="border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 5px 10px; font-weight: bold;">Title:</td><td style="padding: 5px 10px;">${request.title}</td></tr>
          <tr><td style="padding: 5px 10px; font-weight: bold;">Author:</td><td style="padding: 5px 10px;">${request.author || 'Unknown'}</td></tr>
          <tr><td style="padding: 5px 10px; font-weight: bold;">Match Found:</td><td style="padding: 5px 10px;">${searchResult.title}</td></tr>
          <tr><td style="padding: 5px 10px; font-weight: bold;">Match Score:</td><td style="padding: 5px 10px;">${searchResult.relevanceScore}%</td></tr>
          <tr><td style="padding: 5px 10px; font-weight: bold;">Format:</td><td style="padding: 5px 10px;">${searchResult.format || 'Unknown'}</td></tr>
          <tr><td style="padding: 5px 10px; font-weight: bold;">Status:</td><td style="padding: 5px 10px; color: green;">Download started</td></tr>
        </table>
        <p>The book will be available in your library once the download completes.</p>
        <p><em>This is retry attempt ${request.retry_count} after the initial search failed.</em></p>
        <hr>
        <p style="color: #666; font-size: 12px;">BookServe - Your Personal Book Library</p>
      `;

            await emailController.sendNotificationEmail(request.email, subject, text, html);
            console.log(`[Retry] Notification sent to ${request.email} for book: "${request.title}"`);
        } catch (error) {
            console.error('[Retry] Error sending notification:', error.message);
            // Don't throw - notification failure shouldn't stop the retry process
        }
    }
}

module.exports = new RetryService();
