// BookPage.jsx - Standalone book detail page
// Save to: client/src/components/Books/BookPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Grid,
  Button,
  Chip,
  Rating,
  Divider,
  CircularProgress,
  Alert,
  IconButton,
  AppBar,
  Toolbar,
  Paper,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Link,
  Snackbar,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  MenuBook as ReadIcon,
  Download as DownloadIcon,
  Email as EmailIcon,
  Person as AuthorIcon,
  CalendarToday as CalendarIcon,
  CollectionsBookmark as SeriesIcon,
  Category as CategoryIcon,
  Storage as FormatIcon,
} from '@mui/icons-material';
import { booksAPI, emailAPI, progressAPI } from '../../services/api';

// Helper to check if book format needs conversion to EPUB
const needsEpubConversion = (format) => {
  const convertibleFormats = ['mobi', 'azw', 'azw3'];
  return convertibleFormats.includes(format?.toLowerCase());
};

const BookPage = () => {
  console.log('BookPage component loaded!');
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);
  
  // Email dialog state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [saveEmail, setSaveEmail] = useState(false);
  const [hasSavedEmail, setHasSavedEmail] = useState(false);
  const [loadingSavedEmail, setLoadingSavedEmail] = useState(false);
  const [sending, setSending] = useState(false);
  
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    loadBook();
    loadProgress();
  }, [id]);

  useEffect(() => {
    if (emailDialogOpen) {
      fetchSavedEmail();
    }
  }, [emailDialogOpen]);

  const loadBook = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await booksAPI.getById(id);
      setBook(response.data.book);
    } catch (err) {
      console.error('Error loading book:', err);
      setError('Book not found or failed to load');
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    try {
      const response = await progressAPI.getBookProgress(id);
      setProgress(response.data.progress);
    } catch (err) {
      console.error('Error loading progress:', err);
    }
  };

  const fetchSavedEmail = async () => {
    setLoadingSavedEmail(true);
    try {
      const response = await emailAPI.getSavedEmail();
      const savedEmail = response.data.kindle_email;
      if (savedEmail) {
        setEmail(savedEmail);
        setHasSavedEmail(true);
        setSaveEmail(false);
      } else {
        setHasSavedEmail(false);
      }
    } catch (error) {
      console.error('Error fetching saved email:', error);
    } finally {
      setLoadingSavedEmail(false);
    }
  };

  const handleRead = () => {
    navigate(`/read/${id}`);
  };

  const handleDownload = async () => {
    try {
      const format = needsEpubConversion(book.format) ? 'epub' : null;
      const downloadFormat = format || book.format;

      const response = await booksAPI.download(book.id, format);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${book.title}.${downloadFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setSnackbar({ open: true, message: 'Download started', severity: 'success' });
    } catch (error) {
      console.error('Download failed:', error);
      setSnackbar({ open: true, message: 'Download failed', severity: 'error' });
    }
  };

  const handleEmailDialogOpen = () => {
    setEmailDialogOpen(true);
  };

  const handleEmailDialogClose = () => {
    setEmailDialogOpen(false);
    if (!hasSavedEmail) {
      setEmail('');
    }
    setSaveEmail(false);
  };

  const handleEmailSubmit = async () => {
    if (!email) {
      setSnackbar({ open: true, message: 'Please enter an email address', severity: 'warning' });
      return;
    }

    setSending(true);
    try {
      const bookRef = book; // currentBook for modal, book for BookCard/BookPage
      const format = needsEpubConversion(bookRef.format) ? 'epub' : null;
      const response = await emailAPI.sendBook(bookRef.id, email, format, saveEmail);
      
      let message = response.data.message || 'Book sent to email';
      if (response.data.downloadLink) {
        message = 'Book too large to attach — a download link was sent instead.';
      }
      if (saveEmail) {
        message += ' (email saved for future use)';
        setHasSavedEmail(true);
      }
      
      setSnackbar({ open: true, message, severity: 'success' });
      handleEmailDialogClose();
    } catch (error) {
      const errorData = error.response?.data;
      
      if (error.response?.status === 413 && errorData?.isKindle) {
        // Kindle address but book too large
        setSnackbar({ 
          open: true, 
          message: `Book is too large for email (${errorData.sizeMB?.toFixed(1)}MB). Please download directly or use OPDS to access on your Kindle.`,
          severity: 'warning' 
        });
      } else {
        setSnackbar({ 
          open: true, 
          message: errorData?.message || 'Failed to send email', 
          severity: 'error' 
        });
      }
    } finally {
      setSending(false);
    }
  };

  const handleAuthorClick = () => {
    if (book?.author) {
      navigate(`/author/${encodeURIComponent(book.author)}`);
    }
  };

  if (loading) {
    return (
      <Box sx={{ 
        minHeight: '100vh', 
        backgroundColor: '#0f0f0f', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !book) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: '#0f0f0f' }}>
        <AppBar position="static" sx={{ backgroundColor: '#1a1a1a' }}>
          <Toolbar>
            <IconButton edge="start" color="inherit" onClick={() => navigate('/')}>
              <BackIcon />
            </IconButton>
            <Typography variant="h6" sx={{ ml: 2 }}>
              Book Not Found
            </Typography>
          </Toolbar>
        </AppBar>
        <Container maxWidth="md" sx={{ mt: 4 }}>
          <Alert severity="error">
            {error || 'This book could not be found. It may have been removed from the library.'}
          </Alert>
          <Button 
            variant="contained" 
            onClick={() => navigate('/')} 
            sx={{ mt: 2, backgroundColor: '#e50914' }}
          >
            Go to Library
          </Button>
        </Container>
      </Box>
    );
  }

  const coverUrl = booksAPI.getCoverUrl(book.id);
  const categories = book.categories ? book.categories.split(',').map(c => c.trim()) : [];

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#0f0f0f' }}>
      {/* App Bar */}
      <AppBar position="static" sx={{ backgroundColor: '#1a1a1a' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 2, flexGrow: 1 }} noWrap>
            {book.title}
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, pb: 4 }}>
        <Paper sx={{ backgroundColor: '#1a1a1a', p: 3, borderRadius: 2 }}>
          <Grid container spacing={4}>
            {/* Book Cover */}
            <Grid item xs={12} md={4}>
              <Box
                component="img"
                src={coverUrl}
                alt={book.title}
                sx={{
                  width: '100%',
                  maxWidth: 350,
                  height: 'auto',
                  borderRadius: 2,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                  display: 'block',
                  margin: '0 auto',
                }}
                onError={(e) => {
                  e.target.src = '/default-cover.png';
                }}
              />

              {/* Progress indicator */}
              {progress && progress.progress > 0 && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {Math.round(progress.progress)}% complete
                  </Typography>
                </Box>
              )}

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 3 }}>
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  startIcon={<ReadIcon />}
                  onClick={handleRead}
                  sx={{
                    backgroundColor: '#e50914',
                    '&:hover': { backgroundColor: '#b20710' },
                    py: 1.5,
                  }}
                >
                  {progress && progress.progress > 0 ? 'Continue Reading' : 'Read Now'}
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<DownloadIcon />}
                  onClick={handleDownload}
                >
                  Download
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<EmailIcon />}
                  onClick={handleEmailDialogOpen}
                >
                  Send to Email
                </Button>
              </Box>
            </Grid>

            {/* Book Details */}
            <Grid item xs={12} md={8}>
              <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
                {book.title}
              </Typography>

              {book.author && (
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1, 
                    mb: 2,
                    cursor: 'pointer',
                    '&:hover': { color: '#e50914' }
                  }}
                  onClick={handleAuthorClick}
                >
                  <AuthorIcon />
                  <Typography variant="h6" color="text.secondary">
                    {book.author}
                  </Typography>
                </Box>
              )}

              {/* Rating */}
              {book.average_rating && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Rating value={book.average_rating} precision={0.1} readOnly />
                  <Typography variant="body2" color="text.secondary">
                    {book.average_rating.toFixed(1)}
                    {book.ratings_count && ` (${book.ratings_count.toLocaleString()} ratings)`}
                  </Typography>
                </Box>
              )}

              {/* Series */}
              {book.series && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <SeriesIcon color="action" />
                  <Typography variant="body1">
                    {book.series}
                    {book.series_number && ` #${book.series_number}`}
                  </Typography>
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Categories */}
              {categories.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <CategoryIcon color="action" fontSize="small" />
                    <Typography variant="subtitle2" color="text.secondary">
                      Categories
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {categories.map((category, index) => (
                      <Chip key={index} label={category} size="small" />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Description */}
              {book.description && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Description
                  </Typography>
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      lineHeight: 1.7,
                      color: 'text.primary',
                    }}
                    dangerouslySetInnerHTML={{ __html: book.description }}
                  />
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Additional Details */}
              <Grid container spacing={2}>
                {book.publisher && (
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary">Publisher</Typography>
                    <Typography variant="body2">{book.publisher}</Typography>
                  </Grid>
                )}
                {book.published_date && (
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary">Published</Typography>
                    <Typography variant="body2">{book.published_date}</Typography>
                  </Grid>
                )}
                {book.page_count && (
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary">Pages</Typography>
                    <Typography variant="body2">{book.page_count}</Typography>
                  </Grid>
                )}
                {book.isbn && (
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary">ISBN</Typography>
                    <Typography variant="body2">{book.isbn}</Typography>
                  </Grid>
                )}
                {book.language && (
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary">Language</Typography>
                    <Typography variant="body2">{book.language.toUpperCase()}</Typography>
                  </Grid>
                )}
                {book.format && (
                  <Grid item xs={6} sm={4}>
                    <Typography variant="caption" color="text.secondary">Format</Typography>
                    <Typography variant="body2">{book.format.toUpperCase()}</Typography>
                  </Grid>
                )}
              </Grid>
            </Grid>
          </Grid>
        </Paper>
      </Container>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onClose={handleEmailDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Send Book to Email</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.875rem', mb: 2 }}>
            Enter the email address to send this book to.
          </DialogContentText>
          {loadingSavedEmail ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <>
              <TextField
                autoFocus
                margin="dense"
                label="Email Address"
                type="email"
                fullWidth
                variant="outlined"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your-kindle@kindle.com"
                helperText={hasSavedEmail ? "Using your saved email address" : ""}
              />
              {!hasSavedEmail && email && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={saveEmail}
                      onChange={(e) => setSaveEmail(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Save this email for future use"
                  sx={{ mt: 1 }}
                />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEmailDialogClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleEmailSubmit}
            variant="contained"
            disabled={sending || !email}
            sx={{ backgroundColor: '#e50914' }}
          >
            {sending ? <CircularProgress size={24} /> : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BookPage;
