import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Grid,
  Box,
  Button,
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Logout as LogoutIcon,
  Add as AddIcon,
  LibraryBooks as LibraryIcon,
} from '@mui/icons-material';
import { booksAPI } from '../../services/api';
import BookCard from './BookCard';

const Dashboard = ({ onLogout }) => {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      setLoading(true);
      const response = await booksAPI.getAll();
      setBooks(response.data.books);
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadBooks();
      return;
    }

    try {
      setLoading(true);
      const response = await booksAPI.search(searchQuery);
      setBooks(response.data.books);
    } catch (error) {
      console.error('Error searching books:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#0f0f0f' }}>
      <AppBar position="static" sx={{ backgroundColor: '#1a1a1a' }}>
        <Toolbar>
          <LibraryIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            BookServe
          </Typography>
          <Button
            color="inherit"
            startIcon={<AddIcon />}
            onClick={() => navigate('/request')}
            sx={{ mr: 2 }}
          >
            Request Book
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/my-requests')}
            sx={{ mr: 2 }}
          >
            My Requests
          </Button>
          <IconButton color="inherit" onClick={onLogout}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 4, pb: 4 }}>
        <Box component="form" onSubmit={handleSearch} sx={{ mb: 4 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search books by title, author, or ISBN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
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

        {loading ? (
          <Typography variant="h6" align="center" color="text.secondary">
            Loading books...
          </Typography>
        ) : books.length === 0 ? (
          <Box sx={{ textAlign: 'center', mt: 8 }}>
            <Typography variant="h5" color="text.secondary" gutterBottom>
              No books found
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Start building your library by requesting books!
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/request')}
            >
              Request Your First Book
            </Button>
          </Box>
        ) : (
          <>
            <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
              Your Library ({books.length} books)
            </Typography>
            <Grid container spacing={3}>
              {books.map((book) => (
                <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={book.id}>
                  <BookCard book={book} onUpdate={loadBooks} />
                </Grid>
              ))}
            </Grid>
          </>
        )}
      </Container>
    </Box>
  );
};

export default Dashboard;
