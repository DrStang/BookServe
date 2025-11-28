import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  AutoAwesome as AIIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const AIRecommendations = ({ limit = 5 }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiAvailable, setAiAvailable] = useState(true);
  const navigate = useNavigate();

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);

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

      // Fetch recommendations
      const response = await axios.get(`/api/ai/recommendations?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setRecommendations(response.data);
      setAiAvailable(true);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError(err.response?.data?.error || 'Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [limit]);

  const handleBookClick = (bookId) => {
    navigate(`/book/${bookId}`);
  };

  if (!aiAvailable && !loading) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        AI recommendations are currently unavailable. Make sure Ollama is running and configured correctly.
      </Alert>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        No recommendations available yet. Read more books to get personalized suggestions!
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <AIIcon color="primary" />
          <Typography variant="h6">AI Recommendations</Typography>
          <Chip label="Powered by AI" size="small" color="primary" variant="outlined" />
        </Box>
        <Tooltip title="Refresh recommendations">
          <IconButton onClick={fetchRecommendations} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Grid container spacing={2}>
        {recommendations.map((rec) => (
          <Grid item xs={12} sm={6} md={4} key={rec.book.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: '#1e1e1e',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'scale(1.02)'
                }
              }}
            >
              <CardActionArea onClick={() => handleBookClick(rec.book.id)}>
                {rec.book.coverImage && (
                  <CardMedia
                    component="img"
                    height="200"
                    image={`/api/books/${rec.book.id}/cover?token=${localStorage.getItem('token')}`}
                    alt={rec.book.title}
                    sx={{ objectFit: 'contain', bgcolor: '#2a2a2a' }}
                  />
                )}
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" gutterBottom noWrap>
                    {rec.book.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {rec.book.author}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Chip
                      icon={<AIIcon />}
                      label={`Match: ${Math.round((rec.score || 0.7) * 100)}%`}
                      size="small"
                      color="primary"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    "{rec.reason}"
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default AIRecommendations;
