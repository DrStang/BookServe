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
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Search as SearchIcon,
  Add as AddIcon,
  CheckCircle as InLibraryIcon,
  MenuBook as BookIcon,
} from '@mui/icons-material';
import { requestsAPI, booksAPI } from '../../services/api';

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
    const normalized = normalizeText(author);
    // Handle "Last, First" format
    if (author.includes(',')) {
      const parts = author.split(',').map(p => p.trim());
      if (parts.length === 2) {
        return [
          normalizeText(`${parts[1]} ${parts[0]}`),
          normalizeText(`${parts[0]} ${parts[1]}`),
          normalized
        ];
      }
    }
    return [normalized];
  };

  const fetchLibraryBooks = useCallback(async () => {
    try {
      setLoadingLibrary(true);
      const response = await booksAPI.getAll(10000, 0);
      const booksMap = {
        byIsbn: {},
        byTitle: {},
        allBooks: []
      };

      response.data.books?.forEach(book => {
        booksMap.allBooks.push(book);

        const isbn13 = book.isbn_13;
        if (isbn13) {
          booksMap.byIsbn[isbn13.replace(/-/g, '')] = book;
        }
        if (book.isbn) {
          booksMap.byIsbn[book.isbn.replace(/-/g, '')] = book;
        }
        const normalizedTitle = normalizeText(book.title);
        if (normalizedTitle) {
          if (!booksMap.byTitle[normalizedTitle]) {
            booksMap.byTitle[normalizedTitle] = [];
          }
          booksMap.byTitle[normalizedTitle].push(book);
        }
      });
      setLibraryBooks(booksMap);
    } catch (err) {
      console.error('Error fetching library books', err);
    }finally {
      setLoadingLibrary(false);
    }
  }, []);

  useEffect(() => {
    fetchLibraryBooks();
  }, [fetchLibraryBooks]);

  const getLibraryMatch = (searchBook) => {
    if (!libraryBooks.byIsbn) return null;

    const isbn13 = searchBook.isbn_13?.replace(/-/g, '');
    if (isbn13 && libraryBooks.byIsbn[isbn13]) {
      return libraryBooks.byIsbn[isbn13];
    }
    const isbn = searchBook.isbn?.replace(/-/g, '');
    if (isbn && libraryBooks.byIsbn[isbn]) {
      return libraryBooks.byIsbn[isbn];
    }

    const normalizedTitle = normalizeText(searchBook.title);
    const titleMatches = libraryBooks.byTitle[normalizedTitle];

    if (titleMatches && titleMatches.length > 0) {
      // If only one book with this title, return it
      if (titleMatches.length === 1) {
        return titleMatches[0];
      }

      // Multiple books with same title - check author
      const searchAuthors = normalizeAuthor(searchBook.author);
      for (const book of titleMatches) {
        const bookAuthors = normalizeAuthor(book.author);
        // Check if any author format matches
        for (const searchAuthor of searchAuthors) {
          for (const bookAuthor of bookAuthors) {
            if (searchAuthor === bookAuthor) {
              return book;
            }
            // Also check if one contains the other (for partial matches)
            if (searchAuthor.includes(bookAuthor) || bookAuthor.includes(searchAuthor)) {
              return book;
            }
          }
        }
      }
    }

    // Fuzzy title match as last resort
    const searchTitleWords = normalizedTitle.split(' ').filter(w => w.length > 2);
    if (searchTitleWords.length >= 2) {
      for (const book of libraryBooks.allBooks) {
        const bookTitle = normalizeText(book.title);
        const bookTitleWords = bookTitle.split(' ').filter(w => w.length > 2);

        // Check if most significant words match
        const matchingWords = searchTitleWords.filter(w => bookTitleWords.includes(w));
        const matchRatio = matchingWords.length / Math.max(searchTitleWords.length, bookTitleWords.length);

        if (matchRatio >= 0.8) {
          // Also verify author matches somewhat
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
      const response = await requestsAPI.searchOpenLibrary(searchQuery);
      setSearchResults(response.data.books);
    } catch (error) {
      console.error('Error searching:', error);
      setSnackbar({ open: true, message: 'Search failed', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestClick = (book) => {
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

  const handleViewInLibrary = () => {
    if (confirmDialog.libraryMatch) {
      navigate(`/book/${confirmDialog.libraryMatch.id}`);
    }
    handleConfirmDialogClose();
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
                              sx={{
                                height: '100%',
                                backgroundColor: '#1a1a1a',
                                position: 'relative',
                                border: isInLibrary ? '2px solid #4caf50' : 'none',
                              }}
                          >
                            {/* In Library Badge */}
                            {isInLibrary && (
                                <Chip
                                    icon={<InLibraryIcon />}
                                    label="In Library"
                                    size="small"
                                    sx={{
                                      position: 'absolute',
                                      top: 8,
                                      right: 8,
                                      zIndex: 1,
                                      backgroundColor: '#4caf50',
                                      color: 'white',
                                      fontWeight: 'bold',
                                      '& .MuiChip-icon': {
                                        color: 'white',
                                      },
                                    }}
                                />
                            )}

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
                                sx={{
                                  objectFit: 'cover',
                                  opacity: isInLibrary ? 0.8 : 1,
                                }}
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
                            <CardActions sx={{ flexDirection: 'column', gap: 1, p: 2, pt: 0 }}>
                              {isInLibrary ? (
                                  <>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        startIcon={<BookIcon />}
                                        onClick={() => navigate(`/book/${libraryMatch.id}`)}
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
                                        onClick={() => handleRequestClick(book)}
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
                                      onClick={() => handleRequestClick(book)}
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
        </Container>

        {/* Confirmation Dialog for books already in library */}
        <Dialog
            open={confirmDialog.open}
            onClose={handleConfirmDialogClose}
            PaperProps={{
              sx: { backgroundColor: '#1a1a1a' }
            }}
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InLibraryIcon sx={{ color: '#4caf50' }} />
            Book Already in Library
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              <strong>"{confirmDialog.book?.title}"</strong> by {confirmDialog.book?.author} appears to already be in your library
              {confirmDialog.libraryMatch && (
                  <> as <strong>"{confirmDialog.libraryMatch.title}"</strong></>
              )}.
            </DialogContentText>
            <DialogContentText sx={{ mt: 2 }}>
              Would you like to view it in your library, or request it anyway?
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button
                onClick={handleConfirmDialogClose}
                sx={{ color: '#999' }}
            >
              Cancel
            </Button>
            <Button
                onClick={handleRequestAnyway}
                variant="outlined"
                sx={{
                  borderColor: '#666',
                  color: '#ccc',
                  '&:hover': {
                    borderColor: '#e50914',
                    color: '#e50914',
                  },
                }}
            >
              Request Anyway
            </Button>
            <Button
                onClick={handleViewInLibrary}
                variant="contained"
                startIcon={<BookIcon />}
                sx={{
                  backgroundColor: '#4caf50',
                  '&:hover': {
                    backgroundColor: '#388e3c',
                  },
                }}
            >
              View in Library
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
            open={snackbar.open}
            autoHideDuration={6000}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
  );
};

export default RequestBook;
