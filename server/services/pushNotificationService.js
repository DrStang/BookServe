/**
 * Push Notification Service for BookServe
 *
 * Handles web push notifications for:
 * - Book request completed
 * - New book added to library
 * - Reading reminders
 * - Collection updates
 *
 * Setup:
 * 1. Generate VAPID keys: npx web-push generate-vapid-keys
 * 2. Add to .env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL
 * 3. Add routes to server
 */

const webpush = require('web-push');
const { db } = require('../database/init');

class PushNotificationService {
    constructor() {
        this.isConfigured = false;
        this.configure();
    }

    configure() {
        const publicKey = process.env.VAPID_PUBLIC_KEY;
        const privateKey = process.env.VAPID_PRIVATE_KEY;
        const email = process.env.VAPID_EMAIL || 'mailto:admin@bookserve.local';

        if (!publicKey || !privateKey) {
            console.log('[Push] VAPID keys not configured. Push notifications disabled.');
            console.log('[Push] Generate keys with: npx web-push generate-vapid-keys');
            return;
        }

        try {
            webpush.setVapidDetails(email, publicKey, privateKey);
            this.isConfigured = true;
            console.log('[Push] Push notification service configured');
        } catch (error) {
            console.error('[Push] Failed to configure:', error.message);
        }
    }

    /**
     * Initialize push subscriptions table
     */
    async initializeTable() {
        return new Promise((resolve, reject) => {
            db.run(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          endpoint TEXT NOT NULL UNIQUE,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_used DATETIME,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `, (err) => {
                if (err) {
                    console.error('[Push] Error creating subscriptions table:', err);
                    reject(err);
                } else {
                    console.log('[Push] Subscriptions table ready');
                    resolve();
                }
            });
        });
    }

    /**
     * Get VAPID public key for client
     */
    getPublicKey() {
        return process.env.VAPID_PUBLIC_KEY || null;
    }

    /**
     * Save a push subscription for a user
     */
    async saveSubscription(userId, subscription) {
        const { endpoint, keys } = subscription;
        await this.initializeTable();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [userId, endpoint, keys.p256dh, keys.auth],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID });
                }
            );
        });
    }

    /**
     * Remove a push subscription
     */
    async removeSubscription(userId, endpoint) {
        return new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
                [userId, endpoint],
                function(err) {
                    if (err) reject(err);
                    else resolve({ removed: this.changes > 0 });
                }
            );
        });
    }

    /**
     * Get all subscriptions for a user
     */
    async getUserSubscriptions(userId) {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM push_subscriptions WHERE user_id = ?',
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    /**
     * Send notification to a specific user
     */
    async sendToUser(userId, notification) {
        if (!this.isConfigured) {
            console.log('[Push] Not configured, skipping notification');
            return { sent: 0, failed: 0 };
        }

        const subscriptions = await this.getUserSubscriptions(userId);
        return this.sendToSubscriptions(subscriptions, notification);
    }

    /**
     * Send notification to multiple subscriptions
     */
    async sendToSubscriptions(subscriptions, notification) {
        const payload = JSON.stringify({
            title: notification.title || 'BookServe',
            body: notification.body || '',
            icon: notification.icon || '/icons/icon-192x192.png',
            badge: notification.badge || '/icons/badge-72x72.png',
            url: notification.url || '/',
            ...notification.data
        });

        let sent = 0;
        let failed = 0;
        const failedEndpoints = [];

        for (const sub of subscriptions) {
            try {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth
                    }
                };

                await webpush.sendNotification(pushSubscription, payload);
                sent++;

                // Update last used
                db.run(
                    'UPDATE push_subscriptions SET last_used = CURRENT_TIMESTAMP WHERE id = ?',
                    [sub.id]
                );
            } catch (error) {
                failed++;
                console.error(`[Push] Failed to send to subscription ${sub.id}:`, error.message);

                // Remove invalid subscriptions (410 Gone or 404 Not Found)
                if (error.statusCode === 410 || error.statusCode === 404) {
                    failedEndpoints.push(sub.endpoint);
                    db.run('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
                }
            }
        }

        return { sent, failed, failedEndpoints };
    }

    /**
     * Send notification to all users
     */
    async sendToAll(notification) {
        if (!this.isConfigured) return { sent: 0, failed: 0 };

        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM push_subscriptions', [], async (err, subscriptions) => {
                if (err) return reject(err);
                const result = await this.sendToSubscriptions(subscriptions || [], notification);
                resolve(result);
            });
        });
    }

    // ============================================
    // NOTIFICATION TEMPLATES
    // ============================================

    /**
     * Notify user when their book request is completed
     */
    async notifyRequestCompleted(userId, bookTitle, bookId) {
        return this.sendToUser(userId, {
            title: '📚 Book Ready!',
            body: `"${bookTitle}" has been added to your library`,
            url: `/book/${bookId}`,
            data: {
                type: 'request_completed',
                bookId
            }
        });
    }

    /**
     * Notify user of new book in library
     */
    async notifyNewBook(userId, bookTitle, bookId) {
        return this.sendToUser(userId, {
            title: '📖 New Book Added',
            body: `"${bookTitle}" is now available`,
            url: `/book/${bookId}`,
            data: {
                type: 'new_book',
                bookId
            }
        });
    }

    /**
     * Notify user of reading reminder
     */
    async notifyReadingReminder(userId, bookTitle, bookId, progress) {
        return this.sendToUser(userId, {
            title: '📖 Continue Reading?',
            body: `You're ${Math.round(progress)}% through "${bookTitle}"`,
            url: `/read/${bookId}`,
            data: {
                type: 'reading_reminder',
                bookId
            }
        });
    }

    /**
     * Notify all users of new library addition (admin broadcast)
     */
    async broadcastNewBook(bookTitle, bookId) {
        return this.sendToAll({
            title: '📚 New in Library',
            body: `"${bookTitle}" has been added to the library`,
            url: `/book/${bookId}`,
            data: {
                type: 'library_update',
                bookId
            }
        });
    }
}

module.exports = new PushNotificationService();
