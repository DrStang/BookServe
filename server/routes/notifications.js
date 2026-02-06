/**
 * Push Notification Routes for BookServe
 *
 * Handles push subscription management:
 * - Subscribe to notifications
 * - Unsubscribe from notifications
 * - Get VAPID public key
 * - Test notifications (admin)
 *
 * Usage: Add to server/index.js: app.use('/api/notifications', notificationRoutes);
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const pushService = require('../services/pushNotificationService');

/**
 * GET /api/notifications/vapid-key
 * Get the VAPID public key for client-side subscription
 */
router.get('/vapid-key', (req, res) => {
    const publicKey = pushService.getPublicKey();

    if (!publicKey) {
        return res.status(503).json({
            error: 'Push notifications not configured',
            message: 'VAPID keys are not set up on the server'
        });
    }

    res.json({ publicKey });
});

/**
 * POST /api/notifications/subscribe
 * Subscribe to push notifications
 */
router.post('/subscribe', authMiddleware, async (req, res) => {
    try {
        const { subscription } = req.body;

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({ error: 'Invalid subscription object' });
        }

        await pushService.saveSubscription(req.user.id, subscription);

        res.json({
            message: 'Subscribed to push notifications',
            success: true
        });
    } catch (error) {
        console.error('[Notifications] Subscribe error:', error);
        res.status(500).json({ error: 'Failed to subscribe' });
    }
});

/**
 * POST /api/notifications/unsubscribe
 * Unsubscribe from push notifications
 */
router.post('/unsubscribe', authMiddleware, async (req, res) => {
    try {
        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({ error: 'Endpoint required' });
        }

        await pushService.removeSubscription(req.user.id, endpoint);

        res.json({
            message: 'Unsubscribed from push notifications',
            success: true
        });
    } catch (error) {
        console.error('[Notifications] Unsubscribe error:', error);
        res.status(500).json({ error: 'Failed to unsubscribe' });
    }
});

/**
 * GET /api/notifications/status
 * Get notification status for current user
 */
router.get('/status', authMiddleware, async (req, res) => {
    try {
        const subscriptions = await pushService.getUserSubscriptions(req.user.id);

        res.json({
            isConfigured: pushService.isConfigured,
            subscriptionCount: subscriptions.length,
            hasSubscription: subscriptions.length > 0
        });
    } catch (error) {
        console.error('[Notifications] Status error:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

/**
 * POST /api/notifications/test
 * Send a test notification (to yourself)
 */
router.post('/test', authMiddleware, async (req, res) => {
    try {
        const result = await pushService.sendToUser(req.user.id, {
            title: '🔔 Test Notification',
            body: 'Push notifications are working!',
            url: '/'
        });

        if (result.sent === 0) {
            return res.status(400).json({
                error: 'No subscriptions found',
                message: 'Please enable notifications first'
            });
        }

        res.json({
            message: 'Test notification sent',
            ...result
        });
    } catch (error) {
        console.error('[Notifications] Test error:', error);
        res.status(500).json({ error: 'Failed to send test notification' });
    }
});

/**
 * POST /api/notifications/broadcast (Admin only)
 * Send notification to all users
 */
router.post('/broadcast', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { title, body, url } = req.body;

        if (!title || !body) {
            return res.status(400).json({ error: 'Title and body required' });
        }

        const result = await pushService.sendToAll({
            title,
            body,
            url: url || '/'
        });

        res.json({
            message: 'Broadcast sent',
            ...result
        });
    } catch (error) {
        console.error('[Notifications] Broadcast error:', error);
        res.status(500).json({ error: 'Failed to send broadcast' });
    }
});

module.exports = router;