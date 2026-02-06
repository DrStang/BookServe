/**
 * Notification Settings Dialog Component
 *
 * Dialog for managing push notification settings.
 * Used from UserMenu via open/onClose props.
 */

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Typography,
    Switch,
    Button,
    Alert,
    CircularProgress,
    IconButton,
    Divider,
} from '@mui/material';
import {
    Notifications as NotificationsIcon,
    NotificationsActive as NotificationsActiveIcon,
    NotificationsOff as NotificationsOffIcon,
    Close as CloseIcon,
    Send as SendIcon,
} from '@mui/icons-material';
import api from '../../services/api';

const NotificationSettings = ({ open, onClose }) => {
    const [permission, setPermission] = useState('default');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [isSupported, setIsSupported] = useState(true);

    useEffect(() => {
        if (open) {
            checkStatus();
        }
    }, [open]);

    const checkStatus = async () => {
        try {
            setLoading(true);
            setError(null);

            // Check if notifications are supported
            if (!('Notification' in window) || !('serviceWorker' in navigator)) {
                setIsSupported(false);
                setLoading(false);
                return;
            }

            setPermission(Notification.permission);

            // Check server status
            const response = await api.get('/notifications/status');
            setIsSubscribed(response.data.hasSubscription);
        } catch (err) {
            console.error('Error checking notification status:', err);
            // Don't show error if notifications just aren't configured
            if (err.response?.status !== 503) {
                setError('Failed to check notification status');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async () => {
        setToggling(true);
        setError(null);
        setSuccess(null);

        try {
            if (isSubscribed) {
                // Disable notifications
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();

                if (subscription) {
                    await subscription.unsubscribe();
                    await api.post('/notifications/unsubscribe', { endpoint: subscription.endpoint });
                }

                setIsSubscribed(false);
                setSuccess('Notifications disabled');
            } else {
                // Enable notifications
                const permissionResult = await Notification.requestPermission();
                setPermission(permissionResult);

                if (permissionResult !== 'granted') {
                    setError('Notification permission was denied. Please enable notifications in your browser settings.');
                    setToggling(false);
                    return;
                }

                // Get VAPID key from server
                const keyResponse = await api.get('/notifications/vapid-key');
                const vapidPublicKey = keyResponse.data.publicKey;

                if (!vapidPublicKey) {
                    setError('Push notifications are not configured on the server. Please contact the administrator.');
                    setToggling(false);
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
                setSuccess('Notifications enabled! You\'ll be notified when your book requests are ready.');
            }
        } catch (err) {
            console.error('Error toggling notifications:', err);
            setError(err.response?.data?.error || 'Failed to update notification settings');
        } finally {
            setToggling(false);
        }
    };

    const handleSendTest = async () => {
        try {
            setError(null);
            await api.post('/notifications/test');
            setSuccess('Test notification sent! Check your notifications.');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send test notification');
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

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    backgroundColor: '#1a1a1a',
                    color: '#fff',
                },
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <NotificationsIcon sx={{ color: '#e50914' }} />
                    <Typography variant="h6">Push Notifications</Typography>
                </Box>
                <IconButton onClick={onClose} sx={{ color: '#888' }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

            <DialogContent>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress sx={{ color: '#e50914' }} />
                    </Box>
                ) : !isSupported ? (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Push notifications are not supported in this browser.
                    </Alert>
                ) : (
                    <>
                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                                {error}
                            </Alert>
                        )}

                        {success && (
                            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                                {success}
                            </Alert>
                        )}

                        {permission === 'denied' && (
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                Notifications are blocked by your browser. Please enable them in your browser settings and try again.
                            </Alert>
                        )}

                        {/* Main Toggle */}
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                p: 2,
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                borderRadius: 2,
                                mb: 3,
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                {isSubscribed ? (
                                    <NotificationsActiveIcon sx={{ fontSize: 40, color: '#22c55e' }} />
                                ) : (
                                    <NotificationsOffIcon sx={{ fontSize: 40, color: '#888' }} />
                                )}
                                <Box>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                        {isSubscribed ? 'Notifications Enabled' : 'Notifications Disabled'}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#888' }}>
                                        {isSubscribed
                                            ? 'You\'ll receive notifications when your book requests are ready'
                                            : 'Enable to get notified when books are available'
                                        }
                                    </Typography>
                                </Box>
                            </Box>
                            <Switch
                                checked={isSubscribed}
                                onChange={handleToggle}
                                disabled={toggling || permission === 'denied'}
                                sx={{
                                    '& .MuiSwitch-switchBase.Mui-checked': {
                                        color: '#22c55e',
                                    },
                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                        backgroundColor: '#22c55e',
                                    },
                                }}
                            />
                        </Box>

                        {/* Info */}
                        <Typography variant="body2" sx={{ color: '#888', mb: 2 }}>
                            When enabled, you'll receive browser notifications for:
                        </Typography>
                        <Box component="ul" sx={{ color: '#aaa', pl: 2, mb: 3 }}>
                            <li>Book requests completed and ready to read</li>
                            <li>New books added to the library</li>
                            <li>Reading reminders (coming soon)</li>
                        </Box>

                        {/* Test Button */}
                        {isSubscribed && (
                            <Button
                                variant="outlined"
                                startIcon={<SendIcon />}
                                onClick={handleSendTest}
                                fullWidth
                                sx={{
                                    borderColor: 'rgba(255,255,255,0.2)',
                                    color: '#fff',
                                    '&:hover': {
                                        borderColor: '#e50914',
                                        backgroundColor: 'rgba(229, 9, 20, 0.1)',
                                    },
                                }}
                            >
                                Send Test Notification
                            </Button>
                        )}
                    </>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} sx={{ color: '#888' }}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default NotificationSettings;
