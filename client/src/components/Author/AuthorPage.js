import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Grid,
  IconButton,
  AppBar,
  Toolbar,
  FormControl,
  Select,
  MenuItem,
  InputAdornment,
  CircularProgress,
  Avatar,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Sort as SortIcon,
} from '@mui/icons-material';
import { booksAPI, progressAPI } from '../../services/api';
import BookCard from '../Dashboard/BookCard';

const AuthorPage = () => {
  const { authorName } = useParams();
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('added_desc');
  const [readingProgress, setReadingProgress] = useState({});

  useEffect(() => {
    loadAuthorBooks();
    loadReadingProgress();
  }, [authorName, sortBy]);

  const loadAuthorBooks = async () => {
    try {
      setLoading(true);
      // Use the existing books API with author filter
      const [sortField, sortDirection] = sortBy.split('_');
      const sortFieldMap = {
        'added': 'added_at',
        'title': 'title',
        'rating': 'average_rating',
        'published': 'published_date'
      };

      const response = await booksAPI.getAll(
        1000, // Get all books by this author
        0,
        sortFieldMap[sortField] || 'added_at',
        sortDirection?.toUpperCase() || 'DESC',
        { author: authorName }
      );

      setBooks(response.data.books);
    } catch (error) {
      console.error('Error loading author books:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReadingProgress = async () => {
    try {
      const response = await progressAPI.getAllProgress();
      const progressMap = {};
      response.data.progress.forEach(p => {
        progressMap[p.book_id] = p;
      });
      setReadingProgress(progressMap);
    } catch (error) {
      console.error('Error loading reading progress:', error);
    }
  };

  // Get author stats
  const stats = {
    totalBooks: books.length,
    booksRead: books.filter(book =>
      readingProgress[book.id]?.progress === 100
    ).length,
    inProgress: books.filter(book =>
      readingProgress[book.id]?.progress > 0 &&
      readingProgress[book.id]?.progress < 100
    ).length,
    avgRating: books.length > 0
      ? (books.reduce((sum, book) => sum + (book.average_rating || 0), 0) / books.filter(b => b.average_rating).length).toFixed(1)
      : 0,
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#0f0f0f' }}>
      <AppBar position="static" sx={{ backgroundColor: '#1a1a1a' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {decodeURIComponent(authorName)}
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Author Header */}
        <Box sx={{
          mb: 4,
          p: 3,
          backgroundColor: '#1a1a1a',
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 3
        }}>
          <Avatar
            sx={{
              width: 100,
              height: 100,
              fontSize: '2.5rem',
              backgroundColor: '#e50914'
            }}
          >
            {decodeURIComponent(authorName).charAt(0)}
          </Avatar>

          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" gutterBottom>
              {decodeURIComponent(authorName)}
            </Typography>

            <Box sx={{ display: 'flex', gap: 4, mt: 2 }}>
              <Box>
                <Typography variant="h6" color="primary">
                  {stats.totalBooks}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Books in Library
                </Typography>
              </Box>

              <Box>
                <Typography variant="h6" color="primary">
                  {stats.booksRead}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Books Read
                </Typography>
              </Box>

              <Box>
                <Typography variant="h6" color="primary">
                  {stats.inProgress}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  In Progress
                </Typography>
              </Box>

              {stats.avgRating > 0 && (
                <Box>
                  <Typography variant="h6" color="primary">
                    {stats.avgRating}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Avg Rating
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {/* Toolbar */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5">
            Books by {decodeURIComponent(authorName)}
          </Typography>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              startAdornment={
                <InputAdornment position="start">
                  <SortIcon />
                </InputAdornment>
              }
              sx={{
                backgroundColor: '#1a1a1a',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#333',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#e50914',
                },
              }}
            >
              <MenuItem value="added_desc">Recently Added</MenuItem>
              <MenuItem value="added_asc">Oldest First</MenuItem>
              <MenuItem value="title_asc">Title (A-Z)</MenuItem>
              <MenuItem value="title_desc">Title (Z-A)</MenuItem>
              <MenuItem value="rating_desc">Rating (High-Low)</MenuItem>
              <MenuItem value="rating_asc">Rating (Low-High)</MenuItem>
              <MenuItem value="published_desc">Publication Date (Newest)</MenuItem>
              <MenuItem value="published_asc">Publication Date (Oldest)</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Books Grid */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : books.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary">
              No books found by this author
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {books.map((book) => (
              <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={book.id}>
                <BookCard
                  book={book}
                  onUpdate={loadAuthorBooks}
                  readingProgress={readingProgress[book.id]}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
};

export default AuthorPage;
