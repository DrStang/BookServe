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
      const response = await booksAPI.getAll();
      const booksMap = {
        byIsbn: {},
        byTitle: {},
        allBooks: []
      };
      
        response.data.books?.forEach(book => {
        // Store all books for fuzzy matching
          booksMap.allBooks.push(book);
        
        // Index by ISBN13 and ISBN10 (strip hyphens)
          const isbn13 = book.isbn_13 || book.isbn13;
          if (book.isbn13) {
            booksMap.byIsbn[book.isbn13.replace(/-/g, '')] = book;
          }
          if (book.isbn) {
            booksMap.byIsbn[book.isbn.replace(/-/g, '')] = book;
          }
        // Also index by normalized title + author
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
    // Check by ISBN
    const isbn13 = nytBook.primary_isbn13?.replace(/-/g, '');
    const isbn10 = nytBook.primary_isbn10?.replace(/-/g, '');
    
    if (isbn13 && libraryBooks.byIsbn[isbn13]) {
      console.log(`[NYT Match] ISBN13 match for "${nytBook.title}"`);
      return libraryBooks.byIsbn[isbn13];
    }
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

      // Refresh library books to update status
      await fetchLibraryBooks();
    } catch (err) {
      console.error('Error requesting book:', err);
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

  // Render book card
  const renderBookCard = (book, index) => {
    const libraryBook = getLibraryBook(book);
    const inLibrary = !!libraryBook;
    const isRequesting = requestingBook === (book.primary_isbn13 || book.title);

    return (
      <Grid item xs={6} sm={4} md={3} lg={2} key={book.primary_isbn13 || index}>
        <Card
          onClick={() => handleBookClick(book)}
          sx={{
            height: '100%',
            backgroundColor: '#1a1a1a',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            position: 'relative',
            '&:hover': {
              transform: 'translateY(-8px)',
              boxShadow: '0 12px 20px rgba(0,0,0,0.4)',
              '& .book-overlay': {
                opacity: 1,
              },
            },
          }}
        >
          {/* Rank Badge */}
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              zIndex: 2,
              backgroundColor: book.rank <= 3 ? '#e50914' : 'rgba(0,0,0,0.8)',
              color: '#fff',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '0.875rem',
            }}
          >
            {book.rank}
          </Box>

          {/* In Library Badge */}
          {inLibrary && (
            <Chip
              label="In Library"
              size="small"
              color="success"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 2,
                fontSize: '0.65rem',
              }}
            />
          )}

          <CardMedia
            component="img"
            image={book.book_image || DEFAULT_COVER}
            alt={book.title}
            sx={{
              aspectRatio: '2/3',
              objectFit: 'cover',
            }}
            onError={(e) => {
              e.target.src = DEFAULT_COVER;
            }}
          />

          {/* Hover Overlay */}
          <Box
            className="book-overlay"
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.85)',
              opacity: 0,
              transition: 'opacity 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              p: 2,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: '#fff',
                textAlign: 'center',
                fontWeight: 600,
                mb: 1,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {book.title}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255,255,255,0.7)',
                textAlign: 'center',
                mb: 2,
              }}
            >
              {book.author}
            </Typography>
            
            {book.weeks_on_list > 0 && (
              <Chip
                label={`${book.weeks_on_list} week${book.weeks_on_list > 1 ? 's' : ''} on list`}
                size="small"
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  mb: 1,
                }}
              />
            )}

            {!inLibrary && (
              <Tooltip title="Request this book">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRequestBook(book);
                  }}
                  disabled={isRequesting}
                  sx={{
                    backgroundColor: '#e50914',
                    color: '#fff',
                    mt: 1,
                    '&:hover': {
                      backgroundColor: '#b20710',
                    },
                  }}
                >
                  {isRequesting ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <RequestIcon />
                  )}
                </IconButton>
              </Tooltip>
            )}
          </Box>

          <CardContent sx={{ p: 1.5 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.3,
                mb: 0.5,
              }}
            >
              {book.title}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {book.author}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    );
  };

  // Render loading skeletons
  const renderSkeletons = () => (
    <Grid container spacing={2}>
      {[...Array(12)].map((_, i) => (
        <Grid item xs={6} sm={4} md={3} lg={2} key={i}>
          <Card sx={{ backgroundColor: '#1a1a1a' }}>
            <Skeleton
              variant="rectangular"
              sx={{ aspectRatio: '2/3', bgcolor: '#333' }}
            />
            <CardContent>
              <Skeleton variant="text" sx={{ bgcolor: '#333' }} />
              <Skeleton variant="text" width="60%" sx={{ bgcolor: '#333' }} />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#141414' }}>
            <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton edge="start" color="inherit" onClick={() => navigate('/')}>
                <BackIcon />
              </IconButton>  
              <TrophyIcon sx={{ fontSize: 40, color: '#e50914' }} />
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#fff' }}>
                  NYT Bestsellers
                </Typography>
                {publishedDate && (
                  <Typography variant="body2" color="text.secondary">
                    Week of {new Date(publishedDate).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Typography>
                )}
              </Box>
            </Box>

            <Tooltip title="Refresh lists">
              <IconButton
                onClick={() => fetchLists(true)}
                disabled={refreshing}
                sx={{ color: '#fff' }}
              >
                {refreshing ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  <RefreshIcon />
                )}
              </IconButton>
            </Tooltip>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
        </Box>

        {loading ? (
          <>
            <Skeleton variant="rectangular" height={48} sx={{ mb: 3, bgcolor: '#333', borderRadius: 1 }} />
            {renderSkeletons()}
          </>
        ) : lists.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: '#1a1a1a' }}>
            <TrendingIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No bestseller lists available
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try refreshing or check back later
            </Typography>
          </Paper>
        ) : (
          <>
            {/* List Tabs */}
            <Paper sx={{ backgroundColor: '#1a1a1a', mb: 3 }}>
              <Tabs
                value={selectedListIndex}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
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
    </Box>
  );
};

export default NYTBestsellersPage;
