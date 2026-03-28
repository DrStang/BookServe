import React, { useState, useEffect, useCallback } from 'react';
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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  Rating,
  Divider,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Search as SearchIcon,
  Add as AddIcon,
  CheckCircle as InLibraryIcon,
  MenuBook as BookIcon,
  Close as CloseIcon,
  CalendarToday as CalendarIcon,
  Category as CategoryIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { requestsAPI, booksAPI } from '../../services/api';

// ============================================================================
// Book Preview Modal - Shows details when clicking a search result
// ============================================================================
const BookPreviewModal = ({ open, onClose, book, isInLibrary, libraryMatch, onRequest, onViewInLibrary }) => {
  if (!book) return null;

  const coverUrl = book.cover_url || book.thumbnail || null;
  const categories = book.categories ? book.categories.split(',').map(c => c.trim()) : [];

  return (
      <Dialog
          open={open}
          onClose={onClose}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              backgroundColor: '#1a1a1a',
              maxHeight: '90vh',
            }
          }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography variant="h6" component="div" sx={{ pr: 2 }}>
            Book Details
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Grid container spacing={3}>
            {/* Cover Image */}
            <Grid item xs={12} sm={4}>
              {coverUrl ? (
                  <Box
                      component="img"
                      src={coverUrl}
                      alt={book.title}
                      sx={{
                        width: '100%',
                        height: 'auto',
                        maxHeight: 400,
                        objectFit: 'contain',
                        borderRadius: 2,
                        mb: 2,
                      }}
                  />
              ) : (
                  <Box
                      sx={{
                        width: '100%',
                        height: 300,
                        backgroundColor: '#2a2a2a',
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2,
                      }}
                  >
                    <BookIcon sx={{ fontSize: 80, color: '#555' }} />
                  </Box>
              )}

              {/* In Library Badge */}
              {isInLibrary && (
                  <Chip
                      icon={<InLibraryIcon />}
                      label="Already in Library"
                      color="success"
                      sx={{ width: '100%', mb: 1 }}
                  />
              )}
            </Grid>

            {/* Book Details */}
            <Grid item xs={12} sm={8}>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                {book.title}
              </Typography>

              {book.subtitle && (
                  <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                    {book.subtitle}
                  </Typography>
              )}

              <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                by {book.author || 'Unknown Author'}
              </Typography>

              {/* Rating */}
              {book.average_rating && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Rating
                        value={book.average_rating}
                        precision={0.1}
                        readOnly
                        size="small"
                    />
                    <Typography variant="body2" color="text.secondary">
                      {book.average_rating.toFixed(1)}
                      {book.ratings_count && ` (${book.ratings_count.toLocaleString()} ratings)`}
                    </Typography>
                  </Box>
              )}

              {/* Metadata chips */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, mt: 1 }}>
                {book.published_date && (
                    <Chip
                        icon={<CalendarIcon />}
                        label={book.published_date}
                        size="small"
                        variant="outlined"
                        sx={{ borderColor: '#444' }}
                    />
                )}
                {book.page_count && (
                    <Chip
                        label={`${book.page_count} pages`}
                        size="small"
                        variant="outlined"
                        sx={{ borderColor: '#444' }}
                    />
                )}
                {book.publisher && (
                    <Chip
                        label={book.publisher}
                        size="small"
                        variant="outlined"
                        sx={{ borderColor: '#444' }}
                    />
                )}
                {book.language && book.language !== 'en' && (
                    <Chip
                        label={book.language.toUpperCase()}
                        size="small"
                        variant="outlined"
                        sx={{ borderColor: '#444' }}
                    />
                )}
              </Box>

              {/* Categories */}
              {categories.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Categories
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {categories.map((cat, i) => (
                          <Chip
                              key={i}
                              label={cat}
                              size="small"
                              sx={{
                                backgroundColor: '#2a2a2a',
                                fontSize: '0.75rem',
                              }}
                          />
                      ))}
                    </Box>
                  </Box>
              )}

              {/* ISBN */}
              {(book.isbn_13 || book.isbn) && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    ISBN: {book.isbn_13 || book.isbn}
                  </Typography>
              )}

              <Divider sx={{ my: 2, borderColor: '#333' }} />

              {/* Description */}
              {book.description ? (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 'bold' }}>
                      Description
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{
                          lineHeight: 1.7,
                          maxHeight: 300,
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          // Strip HTML tags from Google Books descriptions
                          '& p': { margin: 0 },
                        }}
                        dangerouslySetInnerHTML={{ __html: book.description }}
                    />
                  </Box>
              ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No description available.
                  </Typography>
              )}
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, pt: 1.5, gap: 1 }}>
          {book.preview_link && (
              <Button
                  href={book.preview_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  sx={{ color: '#999', mr: 'auto' }}
              >
                Preview on Google Books
              </Button>
          )}
          {isInLibrary ? (
              <>
                <Button
                    variant="contained"
                    startIcon={<BookIcon />}
                    onClick={onViewInLibrary}
                    sx={{
                      backgroundColor: '#4caf50',
                      '&:hover': { backgroundColor: '#388e3c' },
                    }}
                >
                  View in Library
                </Button>
                <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => onRequest(book)}
                    sx={{
                      borderColor: '#666',
                      color: '#999',
                      '&:hover': { borderColor: '#e50914', color: '#e50914' },
                    }}
                >
                  Request Anyway
                </Button>
              </>
          ) : (
              <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => onRequest(book)}
                  sx={{
                    backgroundColor: '#e50914',
                    '&:hover': { backgroundColor: '#b20710' },
                  }}
              >
                Request This Book
              </Button>
          )}
        </DialogActions>
      </Dialog>
  );
};


// ============================================================================
// Main RequestBook Component
// ============================================================================
const RequestBook = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [libraryBooks, setLibraryBooks] = useState({
    byIsbn: {},
    byTitle: {},
    allBooks: []
  });
  const [loadingLibrary, setLoadingLibrary] = useState(true);

  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    book: null,
    libraryMatch: null
  });

  // Book preview modal state
  const [previewModal, setPreviewModal] = useState({
    open: false,
    book: null,
  });

  // Normalize text for matching (remove punctuation, articles, extra spaces)
  const normalizeText = (text) => {
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/^(the|a|an)\s+/i, '') // Remove leading articles
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
  };

  // Normalize author names to handle different formats
  const normalizeAuthor = (author) => {
    if (!author) return '';
    // Split by common delimiters
    const authors = author.split(/,|&|and/).map(a => a.trim().toLowerCase());
    return authors.map(a => {
      // Handle "Last, First" format
      if (a.includes(',')) {
        const parts = a.split(',').map(p => p.trim());
        return `${parts[1]} ${parts[0]}`;
      }
      return a;
    });
  };

  // Load all library books for matching
  const loadLibraryBooks = useCallback(async () => {
    try {
      setLoadingLibrary(true);
      const response = await booksAPI.getAll(10000, 0);
      const books = response.data.books || response.data || [];

      const byIsbn = {};
      const byTitle = {};

      books.forEach(book => {
        // Index by ISBN
        if (book.isbn) byIsbn[book.isbn.toLowerCase()] = book;
        if (book.isbn_13) byIsbn[book.isbn_13.toLowerCase()] = book;

        // Index by normalized title
        const normTitle = normalizeText(book.title);
        if (normTitle) {
          if (!byTitle[normTitle]) byTitle[normTitle] = [];
          byTitle[normTitle].push(book);
        }
      });

      setLibraryBooks({ byIsbn, byTitle, allBooks: books });
    } catch (error) {
      console.error('Error loading library:', error);
    } finally {
      setLoadingLibrary(false);
    }
  }, []);

  useEffect(() => {
    loadLibraryBooks();
  }, [loadLibraryBooks]);

  // Check if a search result matches a book in the library
  const getLibraryMatch = (searchBook) => {
    // Check by ISBN first (most reliable)
    if (searchBook.isbn) {
      const match = libraryBooks.byIsbn[searchBook.isbn.toLowerCase()];
      if (match) return match;
    }
    if (searchBook.isbn_13) {
      const match = libraryBooks.byIsbn[searchBook.isbn_13.toLowerCase()];
      if (match) return match;
    }

    // Check by normalized title
    const normTitle = normalizeText(searchBook.title);
    if (normTitle && libraryBooks.byTitle[normTitle]) {
      const titleMatches = libraryBooks.byTitle[normTitle];

      // If we have author info, try to match that too
      if (searchBook.author && searchBook.author !== 'Unknown') {
        for (const book of titleMatches) {
          // Check if authors match somewhat
          const searchAuthors = normalizeAuthor(searchBook.author);
          const bookAuthors = normalizeAuthor(book.author);

          for (const searchAuthor of searchAuthors) {
            for (const bookAuthor of bookAuthors) {
              // Check if last names match
              const searchLastName = searchAuthor.split(' ').pop();
              const bookLastName = bookAuthor.split(' ').pop();
              if (searchLastName && bookLastName && searchLastName === bookLastName) {
                return book;
              }
            }
          }
        }
      }
    }

    return null;
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      const response = await requestsAPI.searchBooks(searchQuery);
      setSearchResults(response.data.books);
    } catch (error) {
      console.error('Error searching:', error);
      setSnackbar({ open: true, message: 'Search failed', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Open the preview modal when clicking on a card
  const handleCardClick = (book) => {
    setPreviewModal({ open: true, book });
  };

  const handlePreviewClose = () => {
    setPreviewModal({ open: false, book: null });
  };

  const handleRequestClick = (book) => {
    // Close preview modal if open
    handlePreviewClose();

    const libraryMatch = getLibraryMatch(book);

    if (libraryMatch) {
      // Book is in library - show confirmation dialog
      setConfirmDialog({
        open: true,
        book: book,
        libraryMatch: libraryMatch
      });
    } else {
      // Book not in library - proceed with request
      submitRequest(book);
    }
  };

  const submitRequest = async (book) => {
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

  const handleConfirmDialogClose = () => {
    setConfirmDialog({ open: false, book: null, libraryMatch: null });
  };

  const handleViewInLibrary = (libraryMatch) => {
    const match = libraryMatch || confirmDialog.libraryMatch;
    if (match) {
      navigate(`/book/${match.id}`);
    }
    handleConfirmDialogClose();
    handlePreviewClose();
  };

  const handleRequestAnyway = () => {
    if (confirmDialog.book) {
      submitRequest(confirmDialog.book);
    }
    handleConfirmDialogClose();
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
            <Box sx= {{ flexGrow: 1 }} />
            <Button
                variant="contained"
                edge="end"
                onClick={() => navigate('/my-requests')}
                sx={{ backgroundColor: '#e50914', '&:hover': { backgroundColor: '#b20710' } }}
            >
              My Requests
            </Button>
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

          {/* Loading indicator for library */}
          {loadingLibrary && searchResults.length === 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Loading library for matching...
                </Typography>
              </Box>
          )}

          {searchResults.length > 0 && (
              <>
                <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                  Search Results
                </Typography>
                <Grid container spacing={3}>
                  {searchResults.map((book, index) => {
                    const libraryMatch = getLibraryMatch(book);
                    const isInLibrary = !!libraryMatch;

                    return (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
                          <Card
                              onClick={() => handleCardClick(book)}
                              sx={{
                                height: '100%',
                                backgroundColor: '#1a1a1a',
                                position: 'relative',
                                cursor: 'pointer',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                '&:hover': {
                                  transform: 'translateY(-4px)',
                                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                },
                                border: isInLibrary ? '2px solid #4caf50' : '1px solid #333',
                                display: 'flex',
                                flexDirection: 'column',
                              }}
                          >
                            {isInLibrary && (
                                <Chip
                                    icon={<InLibraryIcon />}
                                    label="In Library"
                                    size="small"
                                    color="success"
                                    sx={{
                                      position: 'absolute',
                                      top: 8,
                                      right: 8,
                                      zIndex: 1,
                                    }}
                                />
                            )}
                            <CardMedia
                                component="img"
                                height="280"
                                image={book.cover_url || book.thumbnail || '/placeholder-book.png'}
                                alt={book.title}
                                sx={{
                                  objectFit: 'contain',
                                  backgroundColor: '#111',
                                  pt: 1,
                                }}
                                onError={(e) => {
                                  e.target.src = '/placeholder-book.png';
                                }}
                            />
                            <CardContent sx={{ flexGrow: 1, pb: 0 }}>
                              <Typography
                                  variant="subtitle1"
                                  sx={{
                                    fontWeight: 'bold',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                  }}
                              >
                                {book.title}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" noWrap>
                                {book.author || 'Unknown Author'}
                              </Typography>
                              {book.published_date && (
                                  <Typography variant="caption" color="text.secondary">
                                    {book.published_date}
                                  </Typography>
                              )}
                              {book.average_rating && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                    <Rating value={book.average_rating} precision={0.1} readOnly size="small" />
                                    <Typography variant="caption" color="text.secondary">
                                      {book.average_rating.toFixed(1)}
                                    </Typography>
                                  </Box>
                              )}
                              {book.description && (
                                  <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        mt: 0.5,
                                      }}
                                      dangerouslySetInnerHTML={{
                                        __html: book.description.substring(0, 150) + '...'
                                      }}
                                  />
                              )}
                            </CardContent>
                            <CardActions sx={{ mt: 'auto', flexDirection: 'column', gap: 1, p: 2 }}>
                              {isInLibrary ? (
                                  <>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        startIcon={<BookIcon />}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(`/book/${libraryMatch.id}`);
                                        }}
                                        sx={{
                                          backgroundColor: '#4caf50',
                                          '&:hover': {
                                            backgroundColor: '#388e3c',
                                          },
                                        }}
                                    >
                                      View in Library
                                    </Button>
                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRequestClick(book);
                                        }}
                                        sx={{
                                          borderColor: '#666',
                                          color: '#999',
                                          '&:hover': {
                                            borderColor: '#e50914',
                                            color: '#e50914',
                                          },
                                        }}
                                    >
                                      Request Anyway
                                    </Button>
                                  </>
                              ) : (
                                  <Button
                                      fullWidth
                                      variant="contained"
                                      startIcon={<AddIcon />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRequestClick(book);
                                      }}
                                  >
                                    Request This Book
                                  </Button>
                              )}
                            </CardActions>
                          </Card>
                        </Grid>
                    );
                  })}
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

          {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
                <CircularProgress />
              </Box>
          )}
        </Container>

        {/* Book Preview Modal */}
        <BookPreviewModal
            open={previewModal.open}
            onClose={handlePreviewClose}
            book={previewModal.book}
            isInLibrary={previewModal.book ? !!getLibraryMatch(previewModal.book) : false}
            libraryMatch={previewModal.book ? getLibraryMatch(previewModal.book) : null}
            onRequest={handleRequestClick}
            onViewInLibrary={() => {
              const match = previewModal.book ? getLibraryMatch(previewModal.book) : null;
              if (match) handleViewInLibrary(match);
            }}
        />

        {/* Confirm dialog for books already in library */}
        <Dialog
            open={confirmDialog.open}
            onClose={handleConfirmDialogClose}
            PaperProps={{
              sx: { backgroundColor: '#1a1a1a' }
            }}
        >
          <DialogTitle>Book Already in Library</DialogTitle>
          <DialogContent>
            <DialogContentText>
              "{confirmDialog.book?.title}" by {confirmDialog.book?.author} appears to already
              be in your library. Would you like to view it or request it anyway?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleConfirmDialogClose} color="inherit">
              Cancel
            </Button>
            <Button
                onClick={() => handleViewInLibrary()}
                variant="contained"
                sx={{
                  backgroundColor: '#4caf50',
                  '&:hover': { backgroundColor: '#388e3c' },
                }}
            >
              View in Library
            </Button>
            <Button
                onClick={handleRequestAnyway}
                variant="outlined"
                sx={{
                  borderColor: '#e50914',
                  color: '#e50914',
                  '&:hover': { borderColor: '#b20710', color: '#b20710' },
                }}
            >
              Request Anyway
            </Button>
          </DialogActions>
        </Dialog>

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
