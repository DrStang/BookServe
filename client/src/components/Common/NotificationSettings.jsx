/**
 * Notification Settings Component
 *
 * Allows users to enable/disable push notifications.
 * Can be added to settings page or user menu.
 */

import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Switch,
    Button,
    Alert,
    CircularProgress,
    Paper,
    Snackbar,
} from '@mui/material';
import {
    Notifications as NotificationIcon,
    NotificationsOff as NotificationOffIcon,
    NotificationsActive as NotificationActiveIcon,
} from '@mui/icons-material';
import api from '../../services/api';

const NotificationSettings = ({ compact = false }) => {
    const [permission, setPermission] = useState(Notification.permission);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [enabling, setEnabling] = useState(false);
    const [error, setError] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '' });

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            setLoading(true);

            // Check if notifications are supported
            if (!('Notification' in window) || !('serviceWorker' in navigator)) {
                setError('Push notifications are not supported in this browser');
                return;
            }

            // Check server status
            const response = await api.get('/notifications/status');
            setIsSubscribed(response.data.hasSubscription);
            setPermission(Notification.permission);
        } catch (err) {
            console.error('Error checking notification status:', err);
        } finally {
            setLoading(false);
        }
    };

    const enableNotifications = async () => {
        try {
            setEnabling(true);
            setError(null);

            // Request permission
            const permissionResult = await Notification.requestPermission();
            setPermission(permissionResult);

            if (permissionResult !== 'granted') {
                setError('Notification permission denied');
                return;
            }

            // Get VAPID public key
            const keyResponse = await api.get('/notifications/vapid-key');
            const vapidPublicKey = keyResponse.data.publicKey;

            if (!vapidPublicKey) {
                setError('Push notifications not configured on server');
                return;
            }

            // Get service worker registration
            const registration = await navigator.serviceWorker.ready;

            // Subscribe to push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });

            // Send subscription to server
            await api.post('/notifications/subscribe', { subscription });

            setIsSubscribed(true);
            setSnackbar({ open: true, message: 'Notifications enabled!' });
        } catch (err) {
            console.error('Error enabling notifications:', err);
            setError(err.response?.data?.error || 'Failed to enable notifications');
        } finally {
            setEnabling(false);
        }
    };

    const disableNotifications = async () => {
        try {
            setEnabling(true);

            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // Unsubscribe locally
                await subscription.unsubscribe();

                // Remove from server
                await api.post('/notifications/unsubscribe', {
                    endpoint: subscription.endpoint
                });
            }

            setIsSubscribed(false);
            setSnackbar({ open: true, message: 'Notifications disabled' });
        } catch (err) {
            console.error('Error disabling notifications:', err);
            setError('Failed to disable notifications');
        } finally {
            setEnabling(false);
        }
    };

    const sendTestNotification = async () => {
        try {
            await api.post('/notifications/test');
            setSnackbar({ open: true, message: 'Test notification sent!' });
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send test');
        }
    };

    // Helper to convert VAPID key
    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }

        return outputArray;
    }

    if (loading) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: compact ? 1 : 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2">Checking notification status...</Typography>
            </Box>
        );
    }

    // Compact version for settings dropdown
    if (compact) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {isSubscribed ? (
                        <NotificationActiveIcon sx={{ color: '#22c55e' }} />
                    ) : (
                        <NotificationOffIcon sx={{ color: '#888' }} />
                    )}
                    <Typography variant="body2">Notifications</Typography>
                </Box>
                <Switch
                    checked={isSubscribed}
                    onChange={isSubscribed ? disableNotifications : enableNotifications}
                    disabled={enabling || permission === 'denied'}
                    color="primary"
                />
            </Box>
        );
    }

    // Full version for settings page
    return (
        <Paper sx={{ p: 3, backgroundColor: '#1a1a1a', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <NotificationIcon sx={{ color: '#e50914', fontSize: 28 }} />
                <Typography variant="h6" sx={{ color: '#fff' }}>
                    Push Notifications
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {permission === 'denied' && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Notifications are blocked by your browser. Please enable them in your browser settings.
                </Alert>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                    <Typography sx={{ color: '#fff' }}>
                        {isSubscribed ? 'Notifications Enabled' : 'Notifications Disabled'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#888' }}>
                        Get notified when your book requests are ready
                    </Typography>
                </Box>
                <Switch
                    checked={isSubscribed}
                    onChange={isSubscribed ? disableNotifications : enableNotifications}
                    disabled={enabling || permission === 'denied'}
                    color="primary"
                />
            </Box>

            {isSubscribed && (
                <Button
                    variant="outlined"
                    size="small"
                    onClick={sendTestNotification}
                    sx={{ borderColor: '#888', color: '#888' }}
                >
                    Send Test Notification
                </Button>
            )}

            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                message={snackbar.message}
            />
        </Paper>
    );
};

export default NotificationSettings;