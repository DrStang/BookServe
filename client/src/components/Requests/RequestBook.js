import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Container,
  Box,
  TextField,
  Button,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  InputAdornment,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Search as SearchIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { requestsAPI } from '../../services/api';

const RequestBook = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      const response = await requestsAPI.searchOpenLibrary(searchQuery);
      setSearchResults(response.data.books);
    } catch (error) {
      console.error('Error searching:', error);
      setSnackbar({ open: true, message: 'Search failed', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (book) => {
    try {
      await requestsAPI.create({
        title: book.title,
        author: book.author,
        isbn: book.isbn,
        openlibrary_id: book.key,
      });
      setSnackbar({
        open: true,
        message: 'Book request submitted successfully!',
        severity: 'success',
      });
      setTimeout(() => navigate('/my-requests'), 2000);
    } catch (error) {
      console.error('Error requesting book:', error);
      setSnackbar({ open: true, message: 'Request failed', severity: 'error' });
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#0f0f0f' }}>
      <AppBar position="static" sx={{ backgroundColor: '#1a1a1a' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" component="div">
            Request a Book
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, pb: 4 }}>
        <Box component="form" onSubmit={handleSearch} sx={{ mb: 4 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search for books by title or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: (
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  sx={{ ml: 1 }}
                >
                  {loading ? 'Searching...' : 'Search'}
                </Button>
              ),
            }}
            sx={{
              backgroundColor: '#1a1a1a',
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: '#333',
                },
                '&:hover fieldset': {
                  borderColor: '#e50914',
                },
              },
            }}
          />
        </Box>

        {searchResults.length > 0 && (
          <>
            <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
              Search Results
            </Typography>
            <Grid container spacing={3}>
              {searchResults.map((book, index) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
                  <Card sx={{ height: '100%', backgroundColor: '#1a1a1a' }}>
                    <CardMedia
                      component="img"
                      height="300"
                      image={
                        book.cover_url ||
                        `https://via.placeholder.com/300x450/1a1a1a/ffffff?text=${encodeURIComponent(
                          book.title
                        )}`
                      }
                      alt={book.title}
                      sx={{ objectFit: 'cover' }}
                    />
                    <CardContent>
                      <Typography gutterBottom variant="h6" component="div">
                        {book.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {book.author}
                      </Typography>
                      {book.first_publish_year && (
                        <Typography variant="caption" color="text.secondary">
                          Published: {book.first_publish_year}
                        </Typography>
                      )}
                    </CardContent>
                    <CardActions>
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => handleRequest(book)}
                      >
                        Request This Book
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </>
        )}

        {!loading && searchResults.length === 0 && searchQuery && (
          <Box sx={{ textAlign: 'center', mt: 8 }}>
            <Typography variant="h6" color="text.secondary">
              No results found. Try a different search term.
            </Typography>
          </Box>
        )}
      </Container>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default RequestBook;
