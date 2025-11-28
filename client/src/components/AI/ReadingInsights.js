import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  AppBar,
  Toolbar,
  IconButton,
  Container
} from '@mui/material';
import {
  Psychology as InsightsIcon,
  TrendingUp as TrendingIcon,
  Explore as ExploreIcon,
  ArrowBack as BackIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AINavMenu from './AINavMenu';

const ReadingInsights = () => {
  const navigate = useNavigate();
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiAvailable, setAiAvailable] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const token = localStorage.getItem('token');

        // Check if AI is available
        const statusResponse = await axios.get('/api/ai/status', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!statusResponse.data.available) {
          setAiAvailable(false);
          setLoading(false);
          return;
        }

        // Fetch insights
        const response = await axios.get('/api/ai/insights', {
          headers: { Authorization: `Bearer ${token}` }
        });

        setInsights(response.data);
        setAiAvailable(true);
      } catch (err) {
        console.error('Error fetching insights:', err);
        setError(err.response?.data?.error || 'Failed to fetch insights');
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, []);

  if (!aiAvailable && !loading) {
    return (
      <Box p={3}>
        <Alert severity="info">
          AI insights are currently unavailable. Make sure Ollama is running and configured correctly.
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!insights) {
    return (
      <Box p={3}>
        <Alert severity="info">
          No insights available yet. Read more books to get personalized insights!
        </Alert>
      </Box>
    );
  }

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
              Reading Insights
            </Typography>
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ mt: 4 }}>
          {renderContent()}
        </Container>
      </Box>
    </Box>
  );

  function renderContent() {
    if (!aiAvailable && !loading) {
      return (
        <Box p={3}>
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <InsightsIcon color="primary" fontSize="large" />
        <Typography variant="h4">Your Reading Insights</Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Preferred Genres */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', bgcolor: '#1e1e1e' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <TrendingIcon color="primary" />
                <Typography variant="h6">Preferred Genres</Typography>
              </Box>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {insights.preferredGenres && insights.preferredGenres.length > 0 ? (
                  insights.preferredGenres.map((genre, index) => (
                    <Chip
                      key={index}
                      label={genre}
                      color="primary"
                      variant={index === 0 ? 'filled' : 'outlined'}
                    />
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No genre preferences identified yet
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Reading Patterns */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%', bgcolor: '#1e1e1e' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Reading Patterns
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {insights.readingPatterns || 'Keep reading to discover your patterns!'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Suggested Genres */}
        <Grid item xs={12}>
          <Card sx={{ bgcolor: '#1e1e1e' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <ExploreIcon color="primary" />
                <Typography variant="h6">Suggested Genres to Explore</Typography>
              </Box>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {insights.suggestedGenres && insights.suggestedGenres.length > 0 ? (
                  insights.suggestedGenres.map((genre, index) => (
                    <Chip
                      key={index}
                      label={genre}
                      color="secondary"
                      variant="outlined"
                      icon={<ExploreIcon />}
                    />
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No suggestions available yet
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      </Box>
    );
  }
};

export default ReadingInsights;
