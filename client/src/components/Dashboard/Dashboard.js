import React, { useState, useEffect, useMemo } from 'react';
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
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  Divider,
  Collapse,
  MenuItem,
  Select,
  FormControl,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Rating,
  LinearProgress,

} from '@mui/material';
// Material UI Icons
import {
  Search as SearchIcon,
  Logout as LogoutIcon,
  Add as AddIcon,
  LibraryBooks as LibraryIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  ViewModule as GridViewIcon,
  ViewList as ListViewIcon,
  MenuBook as ReadIcon,
  Download as DownloadIcon,
  AutoAwesome as AIIcon,
  Psychology as InsightsIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';
import { booksAPI, metadataAPI, progressAPI } from '../../services/api';
import BookCard from './BookCard';
import AdvancedSearch from '../Search/AdvancedSearch';
import BookDetailModal from '../Books/BookDetailModal';
import VirtualizedBookGrid from './VirtualizedBookGrid';
import GoodreadsImport from '../Import/GoodreadsImport';

const DRAWER_WIDTH = 280;
const BOOKS_PER_PAGE = 24;

const Dashboard = ({ onLogout }) => {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [totalBooks, setTotalBooks] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshingMetadata, setRefreshingMetadata] = useState(false);
  const [authorFilterOpen, setAuthorFilterOpen] = useState(true);
  const [genreFilterOpen, setGenreFilterOpen] = useState(false);
  const [seriesFilterOpen, setSeriesFilterOpen] = useState(false);
  const [yearFilterOpen, setYearFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState('added_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [readingProgress, setReadingProgress] = useState({});
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('viewMode') || 'grid';
  });
  const [quickFilter, setQuickFilter] = useState('all');
  const [continueReadingBooks, setContinueReadingBooks] = useState([]);
  const [recentlyReadBooks, setRecentlyReadBooks] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [advancedSearchCriteria, setAdvancedSearchCriteria] = useState(null);
  const [selectedBookForDetail, setSelectedBookForDetail] = useState(null);
  const [bookDetailOpen, setBookDetailOpen] = useState(false);
  const [goodreadsImportOpen, setGoodreadsImportOpen] = useState(false);

  useEffect(() => {
    loadBooks();
    loadReadingProgress();
    loadContinueReading();
    loadRecentlyRead();
    loadAllBooksForFilters();
  }, []);

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  // Listen for custom event to open book detail modal
  useEffect(() => {
    const handleOpenBookDetail = (event) => {
      setSelectedBookForDetail(event.detail);
      setBookDetailOpen(true);
    };

    window.addEventListener('openBookDetail', handleOpenBookDetail);
    return () => window.removeEventListener('openBookDetail', handleOpenBookDetail);
  }, []);

  // Load books when filters, sort, or page changes
  useEffect(() => {
    loadBooks();
  }, [selectedAuthor, selectedGenre, selectedYear, searchQuery, sortBy, currentPage, quickFilter, advancedSearchCriteria]);

  // Reset to page 1 when filters change (but not on initial load)
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [selectedAuthor, selectedGenre, selectedYear, searchQuery, sortBy, quickFilter]);

  const loadBooks = async () => {
    try {
      setLoading(true);

      // Build filter parameters for API
      const filters = {};

      // If advanced search is active, use its criteria
      if (advancedSearchCriteria) {
        Object.assign(filters, advancedSearchCriteria);
      } else {
        // Otherwise use sidebar filters
        if (selectedAuthor) filters.author = selectedAuthor;
        if (selectedGenre) filters.categories = selectedGenre;
        if (selectedYear) filters.year = selectedYear;
      }

      // Handle quick filters
      let limit = BOOKS_PER_PAGE;
      let offset = (currentPage - 1) * BOOKS_PER_PAGE;
      let bookIds = null;

      if (quickFilter === 'continue_reading') {
        bookIds = continueReadingBooks.map(b => b.book_id);
        // For quick filters, we need a different approach - fetch by IDs
        // For now, increase limit and filter client-side
        // TODO: Add backend support for filtering by book IDs
      } else if (quickFilter === 'recently_read') {
        bookIds = recentlyReadBooks.map(b => b.book_id);
      } else if (quickFilter === 'recently_added') {
        // Backend doesn't support date range filtering yet
        // Will filter client-side for now
      }

      // Convert sortBy format (e.g., 'added_desc' to sortBy='added_at', sortOrder='DESC')
      let [sortField, sortDirection] = sortBy.split('_');
      if (sortField === 'added') sortField = 'added_at';
      if (sortField === 'rating') sortField = 'average_rating';
      const sortOrder = sortDirection?.toUpperCase() || 'DESC';

      // If using quick filters with IDs, fetch more and filter client-side
      if (bookIds && bookIds.length > 0) {
        const response = await booksAPI.getAll(1000, 0, sortField, sortOrder, filters);
        const filteredBooks = response.data.books.filter(book => bookIds.includes(book.id));
        setBooks(filteredBooks.slice(offset, offset + limit));
        setTotalBooks(filteredBooks.length);
      } else if (quickFilter === 'recently_added') {
        // Fetch recent books and filter by date
        const response = await booksAPI.getAll(1000, 0, 'added_at', 'DESC', filters);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const filteredBooks = response.data.books.filter(book => new Date(book.added_at) >= thirtyDaysAgo);
        setBooks(filteredBooks.slice(offset, offset + limit));
        setTotalBooks(filteredBooks.length);
      } else {
        // Server-side pagination and filtering
        let searchQuery = '';
        if (searchQuery.trim()) {
          // Use search endpoint
          const response = await booksAPI.search(searchQuery);
          setBooks(response.data.books.slice(offset, offset + limit));
          setTotalBooks(response.data.count);
        } else {
          const response = await booksAPI.getAll(limit, offset, sortField, sortOrder, filters);
          setBooks(response.data.books);
          setTotalBooks(response.data.total);
        }
      }
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load all books for filter counts (in background)
  const [allBooksForFilters, setAllBooksForFilters] = useState([]);
  const loadAllBooksForFilters = async () => {
    try {
      const response = await booksAPI.getAll(10000, 0);
      setAllBooksForFilters(response.data.books);
    } catch (error) {
      console.error('Error loading books for filters:', error);
    }
  };

  const loadReadingProgress = async () => {
    try {
      const response = await progressAPI.getAllProgress();
      // Create a map of book_id to progress for quick lookup
      const progressMap = {};
      response.data.progress.forEach(p => {
        progressMap[p.book_id] = p;
      });
      setReadingProgress(progressMap);
    } catch (error) {
      console.error('Error loading reading progress:', error);
    }
  };

  const loadContinueReading = async () => {
    try {
      const response = await progressAPI.getContinueReading(20);
      setContinueReadingBooks(response.data.books);
    } catch (error) {
      console.error('Error loading continue reading:', error);
    }
  };

  const loadRecentlyRead = async () => {
    try {
      const response = await progressAPI.getRecentlyRead(20);
      setRecentlyReadBooks(response.data.books);
    } catch (error) {
      console.error('Error loading recently read:', error);
    }
  };

  // Calculate author counts
  const authorCounts = useMemo(() => {
    const counts = {};
    allBooksForFilters.forEach(book => {
      const author = book.author || 'Unknown Author';
      counts[author] = (counts[author] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .map(([author, count]) => ({ author, count }));
  }, [allBooksForFilters]);

  // Calculate genre counts
  const genreCounts = useMemo(() => {
    const counts = {};
    allBooksForFilters.forEach(book => {
      if (book.categories) {
        // Split categories by comma and trim
        const genres = book.categories.split(',').map(g => g.trim());
        genres.forEach(genre => {
          if (genre) {
            counts[genre] = (counts[genre] || 0) + 1;
          }
        });
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([genre, count]) => ({ genre, count }));
  }, [allBooksForFilters]);

  // Calculate series counts
  const seriesCounts = useMemo(() => {
    const counts = {};
    allBooksForFilters.forEach(book => {
      if (book.series) {
        counts[book.series] = (counts[book.series] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([series, count]) => ({ series, count }));
  }, [allBooksForFilters]);

  // Calculate year counts
  const yearCounts = useMemo(() => {
    const counts = {};
    allBooksForFilters.forEach(book => {
      if (book.published_date) {
        // Extract year from published_date (could be "2023", "2023-01-01", etc.)
        const year = book.published_date.split('-')[0];
        if (year && year.length === 4) {
          counts[year] = (counts[year] || 0) + 1;
        }
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[0].localeCompare(a[0])) // Sort by year descending
      .map(([year, count]) => ({ year, count }));
  }, [allBooksForFilters]);

  const totalPages = Math.ceil(totalBooks / BOOKS_PER_PAGE);

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    // Search is now handled by useEffect
  };

  const handleRefreshAllMetadata = async () => {
    try {
      setRefreshingMetadata(true);
      await metadataAPI.refreshAllMetadata(true);
      setTimeout(() => {
        loadBooks();
        setRefreshingMetadata(false);
      }, 2000);
    } catch (error) {
      console.error('Error refreshing metadata:', error);
      setRefreshingMetadata(false);
    }
  };

  const handleAdvancedSearch = (criteria) => {
    setAdvancedSearchCriteria(criteria);
    setCurrentPage(1);
    // Clear other filters when using advanced search
    setSelectedAuthor(null);
    setSelectedGenre(null);
    setSelectedYear(null);
    setQuickFilter('all');
    setSearchQuery('');
  };

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging false if leaving the whole drop zone
    if (e.target === e.currentTarget) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const bookFiles = files.filter(file => {
      const ext = file.name.split('.').pop().toLowerCase();
      return ['epub', 'pdf', 'mobi'].includes(ext);
    });

    if (bookFiles.length === 0) {
      setUploadError('Please drop valid book files (.epub, .pdf, .mobi)');
      setTimeout(() => setUploadError(null), 3000);
      return;
    }

    // Upload files one by one
    for (let i = 0; i < bookFiles.length; i++) {
      const file = bookFiles[i];
      setUploadProgress(`Uploading ${i + 1}/${bookFiles.length}: ${file.name}`);

      try {
        const formData = new FormData();
        formData.append('book', file);

        await booksAPI.upload(formData);
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        setUploadError(`Failed to upload ${file.name}`);
        setTimeout(() => setUploadError(null), 5000);
      }
    }

    setUploadProgress(null);
    loadBooks();
    loadReadingProgress();
  };

  return (
    <Box
      sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0f0f0f', position: 'relative' }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag and Drop Overlay */}
      {isDragging && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(229, 9, 20, 0.9)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <LibraryIcon sx={{ fontSize: 100, mb: 2 }} />
            <Typography variant="h3" gutterBottom>
              Drop Books Here
            </Typography>
            <Typography variant="h6">
              Supports EPUB, PDF, and MOBI files
            </Typography>
          </Box>
        </Box>
      )}

      {/* Upload Progress Snackbar */}
      {uploadProgress && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            backgroundColor: '#1a1a1a',
            padding: 2,
            borderRadius: 1,
            zIndex: 10000,
            minWidth: 300,
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          }}
        >
          <Typography variant="body1">{uploadProgress}</Typography>
        </Box>
      )}

      {/* Upload Error Snackbar */}
      {uploadError && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            backgroundColor: '#e50914',
            padding: 2,
            borderRadius: 1,
            zIndex: 10000,
            minWidth: 300,
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          }}
        >
          <Typography variant="body1">{uploadError}</Typography>
        </Box>
      )}

      {/* Filter Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            backgroundColor: '#1a1a1a',
            borderRight: '1px solid #333',
            marginTop: '64px', // Height of AppBar
          },
        }}
      >
        <Box sx={{ overflow: 'auto', p: 2 }}>
          {/* Filter Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <FilterIcon sx={{ mr: 1, color: '#e50914' }} />
            <Typography variant="h6">Filters</Typography>
          </Box>

          {/* Active Filters */}
          {(selectedAuthor || selectedGenre || selectedSeries || selectedYear) && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Active Filters:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {selectedAuthor && (
                  <Chip
                    label={`Author: ${selectedAuthor}`}
                    onDelete={() => setSelectedAuthor(null)}
                    size="small"
                    sx={{ 
                      backgroundColor: '#e50914',
                      '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)' }
                    }}
                  />
                )}
                {selectedGenre && (
                  <Chip
                    label={`Genre: ${selectedGenre}`}
                    onDelete={() => setSelectedGenre(null)}
                    size="small"
                    sx={{ 
                      backgroundColor: '#e50914',
                      '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)' }
                    }}
                  />
                )}
                {selectedSeries && (
                  <Chip
                    label={`Series: ${selectedSeries}`}
                    onDelete={() => setSelectedSeries(null)}
                    size="small"
                    sx={{ 
                      backgroundColor: '#e50914',
                      '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)' }
                    }}
                  />
                )}
                {selectedYear && (
                  <Chip
                    label={`Year: ${selectedYear}`}
                    onDelete={() => setSelectedYear(null)}
                    size="small"
                    sx={{ 
                      backgroundColor: '#e50914',
                      '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)' }
                    }}
                  />
                )}
              </Box>
            </Box>
          )}

          <Divider sx={{ my: 2, borderColor: '#333' }} />

          {/* Author Filter */}
          <Box>
            <ListItemButton onClick={() => setAuthorFilterOpen(!authorFilterOpen)} sx={{ px: 0 }}>
              <ListItemText 
                primary="Author" 
                primaryTypographyProps={{ fontWeight: 600 }}
              />
              {authorFilterOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </ListItemButton>

            <Collapse in={authorFilterOpen} timeout="auto" unmountOnExit>
              <List sx={{ maxHeight: '300px', overflow: 'auto', pt: 0 }}>
                {authorCounts.map(({ author, count }) => (
                  <ListItem key={author} disablePadding>
                    <ListItemButton
                      selected={selectedAuthor === author}
                      onClick={() => setSelectedAuthor(selectedAuthor === author ? null : author)}
                      sx={{
                        py: 0.5,
                        px: 2,
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(229, 9, 20, 0.2)',
                          '&:hover': {
                            backgroundColor: 'rgba(229, 9, 20, 0.3)',
                          },
                        },
                      }}
                    >
                      <ListItemText 
                        primary={author}
                        primaryTypographyProps={{
                          fontSize: '0.875rem',
                          noWrap: true,
                        }}
                      />
                      <Chip
                        label={count}
                        size="small"
                        sx={{
                          height: '20px',
                          minWidth: '28px',
                          fontSize: '0.75rem',
                          backgroundColor: selectedAuthor === author ? '#e50914' : '#333',
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </Box>

          <Divider sx={{ my: 2, borderColor: '#333' }} />

          {/* Genre Filter */}
          {genreCounts.length > 0 && (
            <>
              <Box>
                <ListItemButton onClick={() => setGenreFilterOpen(!genreFilterOpen)} sx={{ px: 0 }}>
                  <ListItemText 
                    primary="Genre" 
                    primaryTypographyProps={{ fontWeight: 600 }}
                  />
                  {genreFilterOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </ListItemButton>

                <Collapse in={genreFilterOpen} timeout="auto" unmountOnExit>
                  <List sx={{ maxHeight: '300px', overflow: 'auto', pt: 0 }}>
                    {genreCounts.map(({ genre, count }) => (
                      <ListItem key={genre} disablePadding>
                        <ListItemButton
                          selected={selectedGenre === genre}
                          onClick={() => setSelectedGenre(selectedGenre === genre ? null : genre)}
                          sx={{
                            py: 0.5,
                            px: 2,
                            '&.Mui-selected': {
                              backgroundColor: 'rgba(229, 9, 20, 0.2)',
                              '&:hover': {
                                backgroundColor: 'rgba(229, 9, 20, 0.3)',
                              },
                            },
                          }}
                        >
                          <ListItemText 
                            primary={genre}
                            primaryTypographyProps={{
                              fontSize: '0.875rem',
                              noWrap: true,
                            }}
                          />
                          <Chip
                            label={count}
                            size="small"
                            sx={{
                              height: '20px',
                              minWidth: '28px',
                              fontSize: '0.75rem',
                              backgroundColor: selectedGenre === genre ? '#e50914' : '#333',
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </Box>
              <Divider sx={{ my: 2, borderColor: '#333' }} />
            </>
          )}

          {/* Series Filter */}
          {seriesCounts.length > 0 && (
            <>
              <Box>
                <ListItemButton onClick={() => setSeriesFilterOpen(!seriesFilterOpen)} sx={{ px: 0 }}>
                  <ListItemText 
                    primary="Series" 
                    primaryTypographyProps={{ fontWeight: 600 }}
                  />
                  {seriesFilterOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </ListItemButton>

                <Collapse in={seriesFilterOpen} timeout="auto" unmountOnExit>
                  <List sx={{ maxHeight: '300px', overflow: 'auto', pt: 0 }}>
                    {seriesCounts.map(({ series, count }) => (
                      <ListItem key={series} disablePadding>
                        <ListItemButton
                          selected={selectedSeries === series}
                          onClick={() => setSelectedSeries(selectedSeries === series ? null : series)}
                          sx={{
                            py: 0.5,
                            px: 2,
                            '&.Mui-selected': {
                              backgroundColor: 'rgba(229, 9, 20, 0.2)',
                              '&:hover': {
                                backgroundColor: 'rgba(229, 9, 20, 0.3)',
                              },
                            },
                          }}
                        >
                          <ListItemText 
                            primary={series}
                            primaryTypographyProps={{
                              fontSize: '0.875rem',
                              noWrap: true,
                            }}
                          />
                          <Chip
                            label={count}
                            size="small"
                            sx={{
                              height: '20px',
                              minWidth: '28px',
                              fontSize: '0.75rem',
                              backgroundColor: selectedSeries === series ? '#e50914' : '#333',
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </Box>
              <Divider sx={{ my: 2, borderColor: '#333' }} />
            </>
          )}

          {/* Year Filter */}
          {yearCounts.length > 0 && (
            <Box>
              <ListItemButton onClick={() => setYearFilterOpen(!yearFilterOpen)} sx={{ px: 0 }}>
                <ListItemText 
                  primary="Year Published" 
                  primaryTypographyProps={{ fontWeight: 600 }}
                />
                {yearFilterOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </ListItemButton>

              <Collapse in={yearFilterOpen} timeout="auto" unmountOnExit>
                <List sx={{ maxHeight: '300px', overflow: 'auto', pt: 0 }}>
                  {yearCounts.map(({ year, count }) => (
                    <ListItem key={year} disablePadding>
                      <ListItemButton
                        selected={selectedYear === year}
                        onClick={() => setSelectedYear(selectedYear === year ? null : year)}
                        sx={{
                          py: 0.5,
                          px: 2,
                          '&.Mui-selected': {
                            backgroundColor: 'rgba(229, 9, 20, 0.2)',
                            '&:hover': {
                              backgroundColor: 'rgba(229, 9, 20, 0.3)',
                            },
                          },
                        }}
                      >
                        <ListItemText 
                          primary={year}
                          primaryTypographyProps={{
                            fontSize: '0.875rem',
                          }}
                        />
                        <Chip
                          label={count}
                          size="small"
                          sx={{
                            height: '20px',
                            minWidth: '28px',
                            fontSize: '0.75rem',
                            backgroundColor: selectedYear === year ? '#e50914' : '#333',
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </Box>
          )}
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: `calc(100% - ${DRAWER_WIDTH}px)`,
        }}
      >
        <AppBar position="fixed" sx={{ backgroundColor: '#1a1a1a', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
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
              onClick={() => navigate('/reading-list')}
              sx={{ mr: 2 }}
            >
              Reading List
            </Button>
            <Button
              color="inherit"
              onClick={() => navigate('/my-requests')}
              sx={{ mr: 2 }}
            >
              My Requests
            </Button>
            <Button
              color="inherit"
              startIcon={<AIIcon />}
              onClick={() => navigate('/ai/recommendations')}
              sx={{
                mr: 2,
                borderLeft: '1px solid rgba(255,255,255,0.1)',
                pl: 2,
                ml: 1
              }}
            >
              AI Features
            </Button>
            <IconButton color="inherit" onClick={onLogout}>
              <LogoutIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: 10, pb: 4 }}>
          {/* Search Bar */}
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
                endAdornment: (
                  <InputAdornment position="end">
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setAdvancedSearchOpen(true)}
                      sx={{
                        borderColor: '#e50914',
                        color: '#e50914',
                        '&:hover': {
                          borderColor: '#b20710',
                          backgroundColor: 'rgba(229, 9, 20, 0.1)',
                        },
                      }}
                    >
                      Advanced Search
                    </Button>
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

          {/* Quick Filters */}
          <Box sx={{ mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label="All Books"
              onClick={() => setQuickFilter('all')}
              color={quickFilter === 'all' ? 'primary' : 'default'}
              sx={{
                backgroundColor: quickFilter === 'all' ? '#e50914' : '#1a1a1a',
                '&:hover': {
                  backgroundColor: quickFilter === 'all' ? '#b20710' : '#333',
                },
              }}
            />
            <Chip
              label={`Continue Reading (${continueReadingBooks.length})`}
              onClick={() => setQuickFilter('continue_reading')}
              color={quickFilter === 'continue_reading' ? 'primary' : 'default'}
              sx={{
                backgroundColor: quickFilter === 'continue_reading' ? '#e50914' : '#1a1a1a',
                '&:hover': {
                  backgroundColor: quickFilter === 'continue_reading' ? '#b20710' : '#333',
                },
              }}
            />
            <Chip
              label={`Recently Read (${recentlyReadBooks.length})`}
              onClick={() => setQuickFilter('recently_read')}
              color={quickFilter === 'recently_read' ? 'primary' : 'default'}
              sx={{
                backgroundColor: quickFilter === 'recently_read' ? '#e50914' : '#1a1a1a',
                '&:hover': {
                  backgroundColor: quickFilter === 'recently_read' ? '#b20710' : '#333',
                },
              }}
            />
            <Chip
              label="Recently Added"
              onClick={() => setQuickFilter('recently_added')}
              color={quickFilter === 'recently_added' ? 'primary' : 'default'}
              sx={{
                backgroundColor: quickFilter === 'recently_added' ? '#e50914' : '#1a1a1a',
                '&:hover': {
                  backgroundColor: quickFilter === 'recently_added' ? '#b20710' : '#333',
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
                {selectedAuthor || selectedGenre || selectedSeries || selectedYear || searchQuery ? 'No books match your filters' : 'No books found'}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {selectedAuthor || selectedGenre || selectedSeries || selectedYear || searchQuery 
                  ? 'Try adjusting your filters or search term' 
                  : 'Start building your library by requesting books!'}
              </Typography>
              {(selectedAuthor || selectedGenre || selectedSeries || selectedYear || searchQuery) && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setSelectedAuthor(null);
                    setSelectedGenre(null);
                    setSelectedSeries(null);
                    setSelectedYear(null);
                    setSearchQuery('');
                  }}
                  sx={{ mr: 2 }}
                >
                  Clear Filters
                </Button>
              )}
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h5" gutterBottom sx={{ mb: 0 }}>
                  {selectedAuthor ? (
                    <>
                      Books by {selectedAuthor} ({totalBooks})
                    </>
                  ) : (
                    <>
                      Your Library ({totalBooks} book{totalBooks !== 1 ? 's' : ''})
                    </>
                  )}
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  {/* View Mode Toggle */}
                  <Box
                    sx={{
                      display: 'flex',
                      border: '1px solid #333',
                      borderRadius: 1,
                      overflow: 'hidden',
                    }}
                  >
                    <IconButton
                      onClick={() => setViewMode('grid')}
                      sx={{
                        borderRadius: 0,
                        color: viewMode === 'grid' ? '#e50914' : 'inherit',
                        backgroundColor: viewMode === 'grid' ? 'rgba(229, 9, 20, 0.1)' : 'transparent',
                        '&:hover': {
                          backgroundColor: viewMode === 'grid' ? 'rgba(229, 9, 20, 0.2)' : 'rgba(255,255,255,0.1)',
                        },
                      }}
                      title="Grid View"
                    >
                      <GridViewIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => setViewMode('list')}
                      sx={{
                        borderRadius: 0,
                        color: viewMode === 'list' ? '#e50914' : 'inherit',
                        backgroundColor: viewMode === 'list' ? 'rgba(229, 9, 20, 0.1)' : 'transparent',
                        '&:hover': {
                          backgroundColor: viewMode === 'list' ? 'rgba(229, 9, 20, 0.2)' : 'rgba(255,255,255,0.1)',
                        },
                      }}
                      title="List View"
                    >
                      <ListViewIcon />
                    </IconButton>
                  </Box>

                  {/* Sort Dropdown */}
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
                      <MenuItem value="author_asc">Author (A-Z)</MenuItem>
                      <MenuItem value="author_desc">Author (Z-A)</MenuItem>
                      <MenuItem value="rating_desc">Rating (High-Low)</MenuItem>
                      <MenuItem value="rating_asc">Rating (Low-High)</MenuItem>
                    </Select>
                  </FormControl>

                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={handleRefreshAllMetadata}
                    disabled={refreshingMetadata}
                    sx={{
                      borderColor: '#e50914',
                      color: '#e50914',
                      '&:hover': {
                        borderColor: '#e50914',
                        backgroundColor: 'rgba(229, 9, 20, 0.1)',
                      },
                    }}
                  >
                    {refreshingMetadata ? 'Refreshing...' : 'Refresh Covers'}
                  </Button>

                  <Button
                    variant="outlined"
                    onClick={() => setGoodreadsImportOpen(true)}
                    sx={{
                      borderColor: '#e50914',
                      color: '#e50914',
                      '&:hover': {
                        borderColor: '#e50914',
                        backgroundColor: 'rgba(229, 9, 20, 0.1)',
                      },
                    }}
                  >
                    Import from Goodreads
                  </Button>
                </Box>
              </Box>

              {/* Book Display - Grid or List View */}
              {viewMode === 'grid' ? (
                books.length > 50 ? (
                  // Use virtual scrolling for large libraries (> 50 books)
                  <VirtualizedBookGrid
                    books={books}
                    readingProgress={readingProgress}
                    onUpdate={loadBooks}
                    onBookClick={(book) => {
                      setSelectedBookForDetail(book);
                      setBookDetailOpen(true);
                    }}
                  />
                ) : (
                  // Use regular grid for smaller libraries
                  <Grid container spacing={3}>
                    {books.map((book) => (
                      <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={book.id}>
                        <BookCard
                          book={book}
                          onUpdate={loadBooks}
                          readingProgress={readingProgress[book.id]}
                          onClick={() => {
                            setSelectedBookForDetail(book);
                            setBookDetailOpen(true);
                          }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                )
              ) : (
                <TableContainer
                  component={Paper}
                  sx={{
                    backgroundColor: '#1a1a1a',
                    '& .MuiTableCell-root': {
                      borderColor: '#333',
                    },
                  }}
                >
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell width="60px">Cover</TableCell>
                        <TableCell>Title</TableCell>
                        <TableCell>Author</TableCell>
                        <TableCell>Rating</TableCell>
                        <TableCell>Format</TableCell>
                        <TableCell>Progress</TableCell>
                        <TableCell>Added</TableCell>
                        <TableCell width="120px">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {books.map((book) => {
                        const progress = readingProgress[book.id];
                        return (
                          <TableRow
                            key={book.id}
                            sx={{
                              '&:hover': {
                                backgroundColor: 'rgba(229, 9, 20, 0.05)',
                              },
                            }}
                          >
                            <TableCell>
                              <Avatar
                                src={book.cover_image ? booksAPI.getCoverUrl(book.id) : null}
                                variant="rounded"
                                sx={{ width: 40, height: 60, cursor: 'pointer' }}
                                onClick={() => navigate(`/read/${book.id}`)}
                              >
                                {book.title[0]}
                              </Avatar>
                            </TableCell>
                            <TableCell>
                              <Typography
                                variant="body1"
                                sx={{
                                  cursor: 'pointer',
                                  '&:hover': { color: '#e50914' },
                                  fontWeight: progress && progress.progress > 0 ? 'bold' : 'normal',
                                }}
                                onClick={() => navigate(`/read/${book.id}`)}
                              >
                                {book.title}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography
                                variant="body2"
                                onClick={() => {
                                  if (book.author) {
                                    navigate(`/author/${encodeURIComponent(book.author)}`);
                                  }
                                }}
                                sx={{
                                  cursor: book.author ? 'pointer' : 'default',
                                  '&:hover': book.author ? {
                                    color: '#e50914',
                                    textDecoration: 'underline'
                                  } : {}
                                }}
                              >
                                {book.author || 'Unknown'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {book.average_rating && (
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Rating value={book.average_rating} precision={0.5} size="small" readOnly />
                                  <Typography variant="caption" sx={{ ml: 0.5 }}>
                                    ({book.average_rating.toFixed(1)})
                                  </Typography>
                                </Box>
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={book.format?.toUpperCase() || 'EPUB'}
                                size="small"
                                sx={{ backgroundColor: '#333' }}
                              />
                            </TableCell>
                            <TableCell>
                              {progress && progress.progress > 0 ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={progress.progress}
                                    sx={{
                                      width: 80,
                                      height: 6,
                                      borderRadius: 3,
                                      backgroundColor: 'rgba(255,255,255,0.1)',
                                      '& .MuiLinearProgress-bar': {
                                        backgroundColor: '#e50914',
                                        borderRadius: 3,
                                      },
                                    }}
                                  />
                                  <Typography variant="caption">
                                    {Math.round(progress.progress)}%
                                  </Typography>
                                </Box>
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  Not started
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {new Date(book.added_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/read/${book.id}`)}
                                title={progress && progress.progress > 0 ? 'Continue Reading' : 'Read'}
                              >
                                <ReadIcon />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={async () => {
                                  try {
                                    const response = await booksAPI.download(book.id);
                                    const url = window.URL.createObjectURL(new Blob([response.data]));
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.setAttribute('download', `${book.title}.${book.format}`);
                                    document.body.appendChild(link);
                                    link.click();
                                    link.remove();
                                  } catch (error) {
                                    console.error('Download failed:', error);
                                  }
                                }}
                              >
                                <DownloadIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <Pagination
                    count={totalPages}
                    page={currentPage}
                    onChange={handlePageChange}
                    color="primary"
                    size="large"
                    showFirstButton
                    showLastButton
                    sx={{
                      '& .MuiPaginationItem-root': {
                        color: '#fff',
                        borderColor: '#333',
                      },
                      '& .Mui-selected': {
                        backgroundColor: '#e50914 !important',
                      },
                    }}
                  />
                </Box>
              )}
            </>
          )}
        </Container>
      </Box>

      {/* Advanced Search Dialog */}
      <AdvancedSearch
        open={advancedSearchOpen}
        onClose={() => setAdvancedSearchOpen(false)}
        onSearch={handleAdvancedSearch}
      />

      {/* Book Detail Modal with Similar Books */}
      <BookDetailModal
        open={bookDetailOpen}
        onClose={() => {
          setBookDetailOpen(false);
          setSelectedBookForDetail(null);
        }}
        book={selectedBookForDetail}
        readingProgress={readingProgress}
      />

      {/* Goodreads Import Dialog */}
      <GoodreadsImport
        open={goodreadsImportOpen}
        onClose={() => setGoodreadsImportOpen(false)}
        onImportComplete={(summary) => {
          // Reload books and requests after import
          loadBooks();
          loadAllBooksForFilters();
        }}
      />
    </Box>
  );
};

export default Dashboard;
