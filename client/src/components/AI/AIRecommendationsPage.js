import React from 'react';
import {
  Container,
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Button
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import AIRecommendations from './AIRecommendations';
import AINavMenu from './AINavMenu';

const AIRecommendationsPage = ({ onLogout }) => {
  const navigate = useNavigate();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <Box
        sx={{
          width: 250,
          flexShrink: 0,
          bgcolor: '#1a1a1a',
          borderRight: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <AINavMenu />
      </Box>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static" sx={{ bgcolor: '#1a1a1a' }}>
          <Toolbar>
            <IconButton edge="start" color="inherit" onClick={() => navigate('/')}>
              <BackIcon />
            </IconButton>
            <Typography variant="h6" sx={{ flexGrow: 1, ml: 2 }}>
              BookServe
            </Typography>
            {onLogout && (
              <Button color="inherit" startIcon={<LogoutIcon />} onClick={onLogout}>
                Logout
              </Button>
            )}
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ mt: 4 }}>
          <AIRecommendations limit={10} />
        </Container>
      </Box>
    </Box>
  );
};

export default AIRecommendationsPage;
