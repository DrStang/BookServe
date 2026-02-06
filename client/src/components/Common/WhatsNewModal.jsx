/**
 * What's New Modal Component
 *
 * Shows new features to users. Displays automatically on first visit
 * after an update, and can be accessed via a "What's New" button.
 *
 * Uses localStorage to track which version the user has seen.
 */

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Chip,
    Divider,
    IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Paper,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    Close as CloseIcon,
    NewReleases as NewIcon,
    Bookmark as CollectionsIcon,
    Search as SearchIcon,
    Wifi as OfflineIcon,
    DevicesOther as OPDSIcon,
    CheckCircle as CheckIcon,
    ArrowForward as ArrowIcon,
    Celebration as CelebrationIcon,
} from '@mui/icons-material';

// Current version - increment this when adding new features
const CURRENT_VERSION = '2.0.0';
const STORAGE_KEY = 'bookserve_whats_new_version';

// Feature list for this version
const NEW_FEATURES = [
    {
        id: 'collections',
        icon: CollectionsIcon,
        title: 'Collections & Reading Lists',
        description: 'Organize your books into custom collections like "Want to Read", "Favorites", or create your own!',
        color: '#3b82f6',
        howToUse: [
            'Click the bookmark icon on any book to add it to a collection',
            'Go to Collections in the sidebar to view and manage your lists',
            'Create custom collections with your own names and colors',
            'Drag and drop to reorder books within a collection',
        ],
    },
    {
        id: 'search',
        icon: SearchIcon,
        title: 'Full-Text Search',
        description: 'Search inside your books! Find that quote or passage you\'re looking for across your entire library.',
        color: '#22c55e',
        howToUse: [
            'Go to Search in the sidebar or press Ctrl+K',
            'Type any word or phrase to search all books',
            'Click a result to jump directly to that section',
            'Use quotes for exact phrase matching',
        ],
    },
    {
        id: 'pwa',
        icon: OfflineIcon,
        title: 'Offline Reading & PWA',
        description: 'Install BookServe as an app and read your books even without internet!',
        color: '#a855f7',
        howToUse: [
            'Click "Install" in your browser\'s address bar to add BookServe to your device',
            'Books you\'ve downloaded will be available offline',
            'Your reading progress syncs automatically when back online',
            'Works on desktop, tablet, and mobile!',
        ],
    },
    {
        id: 'opds',
        icon: OPDSIcon,
        title: 'E-Reader App Support (OPDS)',
        description: 'Connect your favorite e-reader app directly to BookServe! Browse and download books from KOReader, Moon+ Reader, and more.',
        color: '#f59e0b',
        howToUse: [
            'In your e-reader app, add a new OPDS catalog',
            'Enter the URL: http://your-server:5000/opds',
            'Browse by author, genre, series, or search',
            'Download books directly to your e-reader',
        ],
    },
];

const WhatsNewModal = ({ open, onClose, triggerButton = true }) => {
    const [isOpen, setIsOpen] = useState(open || false);
    const [activeStep, setActiveStep] = useState(0);
    const [hasSeenUpdate, setHasSeenUpdate] = useState(true);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Check if user has seen this version
    useEffect(() => {
        const seenVersion = localStorage.getItem(STORAGE_KEY);
        if (seenVersion !== CURRENT_VERSION) {
            setHasSeenUpdate(false);
            setIsOpen(true);
        }
    }, []);

    // Sync with external open prop
    useEffect(() => {
        if (open !== undefined) {
            setIsOpen(open);
        }
    }, [open]);

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
        setHasSeenUpdate(true);
        if (onClose) onClose();
    };

    const handleOpen = () => {
        setIsOpen(true);
        setActiveStep(0);
    };

    const handleNext = () => {
        setActiveStep((prev) => Math.min(prev + 1, NEW_FEATURES.length - 1));
    };

    const handleBack = () => {
        setActiveStep((prev) => Math.max(prev - 1, 0));
    };

    return (
        <>
            {/* Trigger Button */}
            {triggerButton && (
                <Button
                    variant="outlined"
                    startIcon={<NewIcon />}
                    onClick={handleOpen}
                    sx={{
                        borderColor: hasSeenUpdate ? 'rgba(255,255,255,0.2)' : '#e50914',
                        color: hasSeenUpdate ? '#888' : '#e50914',
                        position: 'relative',
                        '&:hover': {
                            borderColor: '#e50914',
                            color: '#e50914',
                            backgroundColor: 'rgba(229, 9, 20, 0.1)',
                        },
                    }}
                >
                    What's New
                    {!hasSeenUpdate && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: -4,
                                right: -4,
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: '#e50914',
                                animation: 'pulse 2s infinite',
                                '@keyframes pulse': {
                                    '0%': { transform: 'scale(1)', opacity: 1 },
                                    '50%': { transform: 'scale(1.2)', opacity: 0.7 },
                                    '100%': { transform: 'scale(1)', opacity: 1 },
                                },
                            }}
                        />
                    )}
                </Button>
            )}

            {/* Modal */}
            <Dialog
                open={isOpen}
                onClose={handleClose}
                maxWidth="md"
                fullWidth
                fullScreen={isMobile}
                PaperProps={{
                    sx: {
                        backgroundColor: '#141414',
                        color: '#fff',
                        backgroundImage: 'linear-gradient(180deg, rgba(229,9,20,0.1) 0%, transparent 200px)',
                    },
                }}
            >
                {/* Header */}
                <DialogTitle sx={{ pb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <CelebrationIcon sx={{ color: '#e50914', fontSize: 32 }} />
                            <Box>
                                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                                    What's New in BookServe
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#888' }}>
                                    Version {CURRENT_VERSION}
                                </Typography>
                            </Box>
                        </Box>
                        <IconButton onClick={handleClose} sx={{ color: '#888' }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                <DialogContent sx={{ p: 0 }}>
                    {/* Feature Overview Cards */}
                    <Box sx={{ p: 3, pb: 2 }}>
                        <Typography variant="subtitle2" sx={{ color: '#888', mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                            New Features
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {NEW_FEATURES.map((feature, index) => {
                                const Icon = feature.icon;
                                return (
                                    <Chip
                                        key={feature.id}
                                        icon={<Icon sx={{ color: `${feature.color} !important` }} />}
                                        label={feature.title}
                                        onClick={() => setActiveStep(index)}
                                        sx={{
                                            backgroundColor: activeStep === index ? `${feature.color}22` : 'rgba(255,255,255,0.05)',
                                            color: activeStep === index ? feature.color : '#fff',
                                            border: activeStep === index ? `1px solid ${feature.color}` : '1px solid transparent',
                                            '&:hover': {
                                                backgroundColor: `${feature.color}22`,
                                            },
                                        }}
                                    />
                                );
                            })}
                        </Box>
                    </Box>

                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                    {/* Feature Details */}
                    <Box sx={{ p: 3 }}>
                        {NEW_FEATURES.map((feature, index) => {
                            const Icon = feature.icon;
                            return (
                                <Box
                                    key={feature.id}
                                    sx={{
                                        display: activeStep === index ? 'block' : 'none',
                                    }}
                                >
                                    {/* Feature Header */}
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 3 }}>
                                        <Box
                                            sx={{
                                                p: 1.5,
                                                borderRadius: 2,
                                                backgroundColor: `${feature.color}22`,
                                            }}
                                        >
                                            <Icon sx={{ fontSize: 40, color: feature.color }} />
                                        </Box>
                                        <Box>
                                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                                {feature.title}
                                            </Typography>
                                            <Typography sx={{ color: '#aaa' }}>
                                                {feature.description}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {/* How to Use */}
                                    <Paper
                                        sx={{
                                            backgroundColor: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: 2,
                                            p: 2,
                                        }}
                                    >
                                        <Typography variant="subtitle2" sx={{ color: feature.color, mb: 2, fontWeight: 'bold' }}>
                                            How to Use
                                        </Typography>
                                        <List dense sx={{ p: 0 }}>
                                            {feature.howToUse.map((step, stepIndex) => (
                                                <ListItem key={stepIndex} sx={{ px: 0, py: 0.5 }}>
                                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                                        <CheckIcon sx={{ color: feature.color, fontSize: 18 }} />
                                                    </ListItemIcon>
                                                    <ListItemText
                                                        primary={step}
                                                        primaryTypographyProps={{ sx: { color: '#ccc' } }}
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </Paper>
                                </Box>
                            );
                        })}
                    </Box>
                </DialogContent>

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                {/* Footer Navigation */}
                <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
                    <Button
                        onClick={handleBack}
                        disabled={activeStep === 0}
                        sx={{ color: '#888' }}
                    >
                        Back
                    </Button>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                        {NEW_FEATURES.map((_, index) => (
                            <Box
                                key={index}
                                sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: activeStep === index ? '#e50914' : 'rgba(255,255,255,0.2)',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s',
                                }}
                                onClick={() => setActiveStep(index)}
                            />
                        ))}
                    </Box>

                    {activeStep === NEW_FEATURES.length - 1 ? (
                        <Button
                            variant="contained"
                            onClick={handleClose}
                            sx={{ backgroundColor: '#e50914' }}
                        >
                            Get Started
                        </Button>
                    ) : (
                        <Button
                            variant="contained"
                            onClick={handleNext}
                            endIcon={<ArrowIcon />}
                            sx={{ backgroundColor: '#e50914' }}
                        >
                            Next
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </>
    );
};

// Export a hook for programmatic control
export const useWhatsNew = () => {
    const [showModal, setShowModal] = useState(false);

    const checkForUpdates = () => {
        const seenVersion = localStorage.getItem(STORAGE_KEY);
        return seenVersion !== CURRENT_VERSION;
    };

    const markAsSeen = () => {
        localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    };

    const resetSeen = () => {
        localStorage.removeItem(STORAGE_KEY);
    };

    return {
        showModal,
        setShowModal,
        checkForUpdates,
        markAsSeen,
        resetSeen,
        currentVersion: CURRENT_VERSION,
    };
};

export default WhatsNewModal;