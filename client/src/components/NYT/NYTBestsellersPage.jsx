import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  IconButton,
  Container,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
  Paper,
  Skeleton,
  Snackbar,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingIcon,
  EmojiEvents as TrophyIcon,
  ArrowForward as ArrowIcon,
  LibraryAdd as RequestIcon,
  ArrowBack as BackIcon,
  CheckCircle as InLibraryIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { nytAPI, booksAPI, requestsAPI } from '../../services/api';
import BookDetailModal from '../Books/BookDetailModal';
import { isAdmin } from '../../utils/auth';

// Default placeholder for books without covers
const DEFAULT_COVER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDIwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiMyMjIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTYiPk5vIENvdmVyPC90ZXh0Pjwvc3ZnPg==';

const NYTBestsellersPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const [lists, setLists] = useState([]);
  const [selectedListIndex, setSelectedListIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [publishedDate, setPublishedDate] = useState(null);

  // Modal state
  const [selectedBook, setSelectedBook] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [libraryBooks, setLibraryBooks] = useState({});
  const [requestingBook, setRequestingBook] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Fetch NYT lists
  const fetchLists = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await nytAPI.getOverview();
      
      if (response.data?.lists) {
        setLists(response.data.lists);
        setPublishedDate(response.data.publishedDate);
      } else if (response.data?.results?.lists) {
        // Handle different response structures
        setLists(response.data.results.lists);
        setPublishedDate(response.data.results.published_date);
      }
    } catch (err) {
      console.error('Error fetching NYT lists:', err);
      setError(err.response?.data?.error || 'Failed to load bestseller lists');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  const normalizeAuthor = (author) => {
    if (!author) return '';
    const normalized = normalizeText(author);
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

  // Fetch library books to check what we already have
  const fetchLibraryBooks = useCallback(async () => {
    try {
      // FIX: Fetch ALL books, not just 100 (the default)
      const response = await booksAPI.getAll(10000, 0);
      const booksMap = {
        byIsbn: {},
        byTitle: {},
        allBooks: []
      };

      console.log(`[NYT] Loaded ${response.data.books?.length || 0} library books for matching`);

      response.data.books?.forEach(book => {
        // Store all books for fuzzy matching
        booksMap.allBooks.push(book);

        // FIX: Use correct field name isbn_13 (snake_case), not isbn13 (camelCase)
        // The API returns snake_case field names from the database
        const isbn13 = book.isbn_13;
        if (isbn13) {
          const cleanIsbn13 = isbn13.replace(/-/g, '');
          booksMap.byIsbn[cleanIsbn13] = book;
        }
        
        // Index by ISBN-10 as well
        if (book.isbn) {
          const cleanIsbn = book.isbn.replace(/-/g, '');
          booksMap.byIsbn[cleanIsbn] = book;
        }

        // Also index by normalized title for fuzzy matching
        const normalizedTitle = normalizeText(book.title);
        if (normalizedTitle) {
          if (!booksMap.byTitle[normalizedTitle]) {
            booksMap.byTitle[normalizedTitle] = [];
          }
          booksMap.byTitle[normalizedTitle].push(book);
        }
      });

      console.log(`[NYT] Indexed ${Object.keys(booksMap.byIsbn).length} ISBNs and ${Object.keys(booksMap.byTitle).length} unique titles`);

      setLibraryBooks(booksMap);
    } catch (err) {
      console.error('Error fetching library books:', err);
    }
  }, []);

  useEffect(() => {
    fetchLists();
    fetchLibraryBooks();
  }, [fetchLists, fetchLibraryBooks]);

  // Check if a book is in the library
  const getLibraryBook = (nytBook) => {
    if (!libraryBooks.byIsbn) return null;

    // Check by ISBN-13
    const isbn13 = nytBook.primary_isbn13?.replace(/-/g, '');
    if (isbn13 && libraryBooks.byIsbn[isbn13]) {
      console.log(`[NYT Match] ISBN13 match for "${nytBook.title}"`);
      return libraryBooks.byIsbn[isbn13];
    }

    // Check by ISBN-10
    const isbn10 = nytBook.primary_isbn10?.replace(/-/g, '');
    if (isbn10 && libraryBooks.byIsbn[isbn10]) {
      console.log(`[NYT Match] ISBN10 match for "${nytBook.title}"`);
      return libraryBooks.byIsbn[isbn10];
    }

    // Check by normalized title
    const normalizedTitle = normalizeText(nytBook.title);
    const titleMatches = libraryBooks.byTitle[normalizedTitle];

    if (titleMatches && titleMatches.length > 0) {
      // If only one book with this title, return it
      if (titleMatches.length === 1) {
        console.log(`[NYT Match] Exact title match for "${nytBook.title}"`);
        return titleMatches[0];
      }

      // Multiple books with same title - check author
      const nytAuthors = normalizeAuthor(nytBook.author);
      for (const book of titleMatches) {
        const bookAuthors = normalizeAuthor(book.author);
        // Check if any author format matches
        for (const nytAuthor of nytAuthors) {
          for (const bookAuthor of bookAuthors) {
            if (nytAuthor === bookAuthor) {
              console.log(`[NYT Match] Title + author match for "${nytBook.title}"`);
              return book;
            }
            // Also check if one contains the other (for partial matches)
            if (nytAuthor.includes(bookAuthor) || bookAuthor.includes(nytAuthor)) {
              console.log(`[NYT Match] Title + partial author match for "${nytBook.title}"`);
              return book;
            }
          }
        }
      }
    }

    // Fuzzy title match as last resort (for slight variations)
    const nytTitleWords = normalizedTitle.split(' ').filter(w => w.length > 2);
    if (nytTitleWords.length >= 2) {
      for (const book of libraryBooks.allBooks) {
        const bookTitle = normalizeText(book.title);
        const bookTitleWords = bookTitle.split(' ').filter(w => w.length > 2);

        // Check if most significant words match
        const matchingWords = nytTitleWords.filter(w => bookTitleWords.includes(w));
        const matchRatio = matchingWords.length / Math.max(nytTitleWords.length, bookTitleWords.length);

        if (matchRatio >= 0.8) {
          // Also verify author matches somewhat
          const nytAuthors = normalizeAuthor(nytBook.author);
          const bookAuthors = normalizeAuthor(book.author);

          for (const nytAuthor of nytAuthors) {
            for (const bookAuthor of bookAuthors) {
              // Check if last names match (usually most reliable)
              const nytLastName = nytAuthor.split(' ').pop();
              const bookLastName = bookAuthor.split(' ').pop();
              if (nytLastName && bookLastName && nytLastName === bookLastName) {
                console.log(`[NYT Match] Fuzzy match for "${nytBook.title}" -> "${book.title}"`);
                return book;
              }
            }
          }
        }
      }
    }

    // Log when no match is found for debugging
    console.log(`[NYT No Match] "${nytBook.title}" by ${nytBook.author} (ISBN13: ${nytBook.primary_isbn13}, ISBN10: ${nytBook.primary_isbn10})`);

    return null;
  };

  // Handle book click
  const handleBookClick = async (nytBook) => {
    const libraryBook = getLibraryBook(nytBook);

    if (libraryBook) {
      // Book is in library, open detail modal
      setSelectedBook(libraryBook);
      setModalOpen(true);
    } else {
      // Book not in library, create a temporary book object for the modal
      // This allows viewing details and potentially requesting the book
      const tempBook = {
        id: null, // No library ID
        title: nytBook.title,
        author: nytBook.author,
        description: nytBook.description,
        coverUrl: nytBook.book_image,
        isbn13: nytBook.primary_isbn13,
        isbn: nytBook.primary_isbn10,
        publisher: nytBook.publisher,
        // NYT specific fields
        nytData: {
          rank: nytBook.rank,
          weeksOnList: nytBook.weeks_on_list,
          amazonUrl: nytBook.amazon_product_url,
          buyLinks: nytBook.buy_links,
        },
        isNytBook: true, // Flag to indicate this is from NYT, not library
      };
      setSelectedBook(tempBook);
      setModalOpen(true);
    }
  };

  // Handle requesting a book
  const handleRequestBook = async (nytBook) => {
    try {
      setRequestingBook(nytBook.primary_isbn13 || nytBook.title);

      await requestsAPI.create({
        title: nytBook.title,
        author: nytBook.author,
        isbn: nytBook.primary_isbn13 || nytBook.primary_isbn10,
      });

      setSnackbar({
        open: true,
        message: `"${nytBook.title}" has been requested!`,
        severity: 'success',
      });

      // Refresh library books to update status
      await fetchLibraryBooks();
    } catch (err) {
      console.error('Error requesting book:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to request book',
        severity: 'error',
      });
    } finally {
      setRequestingBook(null);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedBook(null);
  };

  const handleTabChange = (event, newValue) => {
    setSelectedListIndex(newValue);
  };

  const currentList = lists[selectedListIndex];

  // Handle request button click (separate from card click)
  const handleRequestClick = async (e, book) => {
    e.stopPropagation(); // Prevent card click
    await handleRequestBook(book);
  };

  // Render book card
  const renderBookCard = (book, index) => {
    const libraryBook = getLibraryBook(book);
    const inLibrary = !!libraryBook;
    const isRequesting = requestingBook === (book.primary_isbn13 || book.title);

    return (
      <Grid item xs={6} sm={4} md={3} lg={2} key={book.primary_isbn13 || index}>
        <Card
          sx={{
            height: '100%',
            backgroundColor: '#1a1a1a',
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
            position: 'relative',
            border: inLibrary ? '2px solid #4caf50' : 'none',
            '&:hover': {
              transform: 'scale(1.03)',
              boxShadow: '0 8px 25px rgba(229, 9, 20, 0.3)',
            },
            '&:hover .request-overlay': {
              opacity: 1,
            },
          }}
          onClick={() => handleBookClick(book)}
        >
          {/* Rank Badge */}
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              zIndex: 2,
              backgroundColor: '#e50914',
              color: 'white',
              borderRadius: '50%',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            {book.rank}
          </Box>

          {/* In Library Badge */}
          {inLibrary && (
            <Chip
              icon={<InLibraryIcon />}
              label="In Library"
              size="small"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 2,
                backgroundColor: '#4caf50',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.7rem',
                height: 24,
                '& .MuiChip-icon': {
                  color: 'white',
                  fontSize: '0.9rem',
                },
              }}
            />
          )}

          {/* Weeks on List Badge */}
          {book.weeks_on_list > 1 && (
            <Tooltip title={`${book.weeks_on_list} weeks on list`}>
              <Chip
                icon={<TrendingIcon />}
                label={`${book.weeks_on_list}w`}
                size="small"
                sx={{
                  position: 'absolute',
                  top: inLibrary ? 40 : 8,
                  right: 8,
                  zIndex: 2,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  color: '#ffd700',
                  fontSize: '0.7rem',
                  height: 22,
                  '& .MuiChip-icon': {
                    color: '#ffd700',
                    fontSize: '0.8rem',
                  },
                }}
              />
            </Tooltip>
          )}

          <CardMedia
            component="img"
            height={isMobile ? 180 : 220}
            image={book.book_image || DEFAULT_COVER}
            alt={book.title}
            sx={{
              objectFit: 'cover',
              opacity: inLibrary ? 0.85 : 1,
            }}
          />

          {/* Request Overlay - shows on hover for books not in library */}
          {!inLibrary && (
            <Box
              className="request-overlay"
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.2s',
                zIndex: 3,
              }}
              onClick={(e) => handleRequestClick(e, book)}
            >
              <Box sx={{ textAlign: 'center' }}>
                {isRequesting ? (
                  <CircularProgress size={40} sx={{ color: '#e50914' }} />
                ) : (
                  <>
                    <IconButton
                      sx={{
                        backgroundColor: '#e50914',
                        color: 'white',
                        width: 56,
                        height: 56,
                        '&:hover': {
                          backgroundColor: '#b20710',
                          transform: 'scale(1.1)',
                        },
                      }}
                    >
                      <RequestIcon sx={{ fontSize: 28 }} />
                    </IconButton>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'white',
                        mt: 1,
                        fontWeight: 600,
                      }}
                    >
                      Request Book
                    </Typography>
                  </>
                )}
              </Box>
            </Box>
          )}

          <CardContent sx={{ p: 1.5 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.3,
                minHeight: '2.6em',
                fontSize: isMobile ? '0.8rem' : '0.875rem',
              }}
            >
              {book.title}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                mt: 0.5,
              }}
            >
              {book.author}
            </Typography>

            {/* Action indicator */}
            {!inLibrary && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mt: 1,
                  color: 'text.secondary',
                  fontSize: '0.7rem',
                }}
              >
                {isRequesting ? (
                  <CircularProgress size={12} sx={{ mr: 0.5 }} />
                ) : (
                  <RequestIcon sx={{ fontSize: 14, mr: 0.5 }} />
                )}
                <Typography variant="caption">
                  {isRequesting ? 'Requesting...' : 'Click to request'}
                </Typography>
              </Box>
            )}

            {inLibrary && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mt: 1,
                  color: '#4caf50',
                  fontSize: '0.7rem',
                }}
              >
                <InLibraryIcon sx={{ fontSize: 14, mr: 0.5 }} />
                <Typography variant="caption" sx={{ color: '#4caf50' }}>
                  Click to view
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>
    );
  };

  // Render loading skeleton
  const renderSkeleton = () => (
    <Grid container spacing={2}>
      {[...Array(10)].map((_, index) => (
        <Grid item xs={6} sm={4} md={3} lg={2} key={index}>
          <Card sx={{ backgroundColor: '#1a1a1a' }}>
            <Skeleton variant="rectangular" height={200} />
            <CardContent>
              <Skeleton variant="text" width="80%" />
              <Skeleton variant="text" width="60%" />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#0f0f0f', pb: 4 }}>
      {/* Header */}
      <Box
        sx={{
          background: 'linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%)',
          pt: 2,
          pb: 3,
        }}
      >
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <IconButton
              onClick={() => navigate('/')}
              sx={{ color: 'white', mr: 2 }}
            >
              <BackIcon />
            </IconButton>
            <TrophyIcon sx={{ color: '#ffd700', fontSize: 32, mr: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#fff' }}>
              NYT Bestsellers
            </Typography>
            <Tooltip title="Refresh lists">
              <IconButton
                onClick={() => fetchLists(true)}
                disabled={refreshing}
                sx={{ ml: 2, color: 'white' }}
              >
                {refreshing ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  <RefreshIcon />
                )}
              </IconButton>
            </Tooltip>
          </Box>

          {publishedDate && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: 7 }}>
              List published: {new Date(publishedDate).toLocaleDateString()}
            </Typography>
          )}
        </Container>
      </Box>

      <Container maxWidth="xl">
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          renderSkeleton()
        ) : (
          <>
            {/* Category Tabs */}
            <Paper
              sx={{
                backgroundColor: '#1a1a1a',
                mb: 3,
                position: 'sticky',
                top: 0,
                zIndex: 10,
              }}
            >
              <Tabs
                value={selectedListIndex}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  '& .MuiTab-root': {
                    color: 'rgba(255,255,255,0.7)',
                    textTransform: 'none',
                    minWidth: isMobile ? 120 : 150,
                    '&.Mui-selected': {
                      color: '#e50914',
                    },
                  },
                  '& .MuiTabs-indicator': {
                    backgroundColor: '#e50914',
                  },
                }}
              >
                {lists.map((list, index) => (
                  <Tab
                    key={list.list_name_encoded || index}
                    label={list.display_name || list.list_name}
                    icon={
                      <Chip
                        label={list.books?.length || 0}
                        size="small"
                        sx={{
                          ml: 1,
                          height: 20,
                          fontSize: '0.7rem',
                          backgroundColor: selectedListIndex === index ? '#e50914' : 'rgba(255,255,255,0.1)',
                          color: '#fff',
                        }}
                      />
                    }
                    iconPosition="end"
                  />
                ))}
              </Tabs>
            </Paper>

            {/* Current List Info */}
            {currentList && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, color: '#fff', mb: 1 }}>
                  {currentList.display_name || currentList.list_name}
                </Typography>
                {currentList.updated && (
                  <Typography variant="body2" color="text.secondary">
                    Updated: {currentList.updated}
                  </Typography>
                )}
              </Box>
            )}

            {/* Books Grid */}
            {currentList?.books && (
              <Grid container spacing={2}>
                {currentList.books.map((book, index) => renderBookCard(book, index))}
              </Grid>
            )}
          </>
        )}
      </Container>

      {/* Book Detail Modal */}
      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          open={modalOpen}
          onClose={handleCloseModal}
          onRefresh={fetchLibraryBooks}
        />
      )}

      {/* Snackbar for request feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default NYTBestsellersPage;
