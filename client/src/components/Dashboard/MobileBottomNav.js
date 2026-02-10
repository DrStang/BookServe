import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    BottomNavigation,
    BottomNavigationAction,
    Paper,
    Badge,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    LibraryBooks as LibraryIcon,
    Add as AddIcon,
    AutoStories as ReadingListIcon,
    AutoAwesome as AIIcon,
    EmojiEvents as BestsellersIcon,
} from '@mui/icons-material';

/**
 * MobileBottomNav
 *
 * A bottom navigation bar that only renders on mobile/tablet screens.
 * Provides quick access to the most important sections of BookServe.
 * Hides on desktop where the AppBar buttons are visible.
 */
const MobileBottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    if (!isMobile) return null;

    // Determine active tab based on current path
    const getActiveTab = () => {
        const path = location.pathname;
        if (path === '/' || path === '/dashboard') return 0;
        if (path === '/request' || path === '/my-requests') return 1;
        if (path === '/reading-list') return 2;
        if (path === '/bestsellers') return 3;
        if (path.startsWith('/ai/')) return 4;
        return 0;
    };

    return (
        <Paper
            sx={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 1200,
                // Extra bottom padding for iPhone home indicator
                pb: 'env(safe-area-inset-bottom, 0px)',
            }}
            elevation={8}
        >
            <BottomNavigation
                value={getActiveTab()}
                onChange={(event, newValue) => {
                    const routes = ['/', '/request', '/reading-list', '/bestsellers', '/ai/recommendations'];
                    navigate(routes[newValue]);
                }}
                showLabels
                sx={{
                    backgroundColor: '#1a1a1a',
                    borderTop: '1px solid #333',
                    height: 60,
                    '& .MuiBottomNavigationAction-root': {
                        color: 'rgba(255,255,255,0.5)',
                        minWidth: 'auto',
                        padding: '6px 0',
                        '&.Mui-selected': {
                            color: '#e50914',
                        },
                    },
                    '& .MuiBottomNavigationAction-label': {
                        fontSize: '0.65rem',
                        '&.Mui-selected': {
                            fontSize: '0.7rem',
                        },
                    },
                }}
            >
                <BottomNavigationAction label="Library" icon={<LibraryIcon />} />
                <BottomNavigationAction label="Request" icon={<AddIcon />} />
                <BottomNavigationAction label="Reading" icon={<ReadingListIcon />} />
                <BottomNavigationAction label="NYT" icon={<BestsellersIcon />} />
                <BottomNavigationAction label="AI" icon={<AIIcon />} />
            </BottomNavigation>
        </Paper>
    );
};

export default MobileBottomNav;
