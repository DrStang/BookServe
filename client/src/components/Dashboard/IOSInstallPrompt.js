import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    IconButton,
    Slide,
} from '@mui/material';
import {
    Close as CloseIcon,
    IosShare as ShareIcon,
    AddBox as AddBoxIcon,
} from '@mui/icons-material';

/**
 * iOS PWA Install Prompt
 *
 * Shows a dismissible banner on iOS Safari explaining how to
 * "Add to Home Screen". Only appears if:
 * - User is on iOS
 * - User is using Safari (not in-app browser)
 * - App is NOT already running in standalone mode (already installed)
 * - User hasn't dismissed it before
 */
const IOSInstallPrompt = () => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Check if iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        // Check if in standalone mode (already installed)
        const isStandalone = window.navigator.standalone === true;
        // Check if Safari (not Chrome/Firefox on iOS, which can't install PWAs)
        const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(navigator.userAgent);
        // Check if user has dismissed before
        const dismissed = localStorage.getItem('ios-install-dismissed');

        if (isIOS && !isStandalone && isSafari && !dismissed) {
            // Delay showing to not interrupt initial page load
            const timer = setTimeout(() => setShow(true), 3000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleDismiss = () => {
        setShow(false);
        localStorage.setItem('ios-install-dismissed', 'true');
    };

    if (!show) return null;

    return (
        <Slide direction="up" in={show} mountOnEnter unmountOnExit>
            <Box
                sx={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    backgroundColor: '#1a1a1a',
                    borderTop: '2px solid #e50914',
                    p: 2,
                    pb: 3, // Extra padding for iPhone home indicator
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5,
                    boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
                }}
            >
                {/* App icon */}
                <Box
                    sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '12px',
                        backgroundColor: '#e50914',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>B</Typography>
                </Box>

                {/* Instructions */}
                <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Install BookServe
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                        Tap <ShareIcon sx={{ fontSize: 16, verticalAlign: 'middle', mx: 0.3, color: '#007AFF' }} /> then{' '}
                        <strong>"Add to Home Screen"</strong> <AddBoxIcon sx={{ fontSize: 16, verticalAlign: 'middle', mx: 0.3, color: '#007AFF' }} />
                    </Typography>
                </Box>

                {/* Dismiss button */}
                <IconButton
                    size="small"
                    onClick={handleDismiss}
                    sx={{ color: 'rgba(255,255,255,0.5)', mt: -0.5 }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>
        </Slide>
    );
};

export default IOSInstallPrompt;
