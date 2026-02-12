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
  useMediaQuery,
  useTheme,
  Badge,
  SwipeableDrawer,
  Fab,
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
  CollectionsBookmark as CollectionsIcon,
  SearchOutlined as FullTextSearchIcon,
  Psychology as InsightsIcon,
  Chat as ChatIcon,
  AdminPanelSettings as AdminIcon,
  EmojiEvents,
  Close as CloseIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';
import { booksAPI, metadataAPI, progressAPI } from '../../services/api';
import BookCard from './BookCard';
import AdvancedSearch from '../Search/AdvancedSearch';
import BookDetailModal from '../Books/BookDetailModal';
import VirtualizedBookGrid from './VirtualizedBookGrid';
import GoodreadsImport from '../Import/GoodreadsImport';
import AdminNavButton from '../Admin/AdminNavButton';
import UserMenu from './UserMenu';
import MobileBottomNav from './MobileBottomNav';
import IOSInstallPrompt from './IOSInstallPrompt';

const DRAWER_WIDTH = 280;
const BOOKS_PER_PAGE = 24;

const Dashboard = ({ onLogout }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

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

  // Mobile-specific state
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Count active filters for badge
  const activeFilterCount = [selectedAuthor, selectedGenre, selectedSeries, selectedYear].filter(Boolean).length;

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
  }, [selectedAuthor, selectedGenre, selectedSeries, selectedYear, searchQuery, sortBy, currentPage, quickFilter, advancedSearchCriteria]);

  // Reset to page 1 when filters change (but not on initial load)
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [selectedAuthor, selectedGenre, selectedSeries, selectedYear, searchQuery, sortBy, quickFilter]);


  
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
        if (selectedSeries) filters.series = selectedSeries;
        if (selectedYear) filters.year = selectedYear;
      }

      // Handle quick filters
      let limit = BOOKS_PER_PAGE;
      let offset = (currentPage - 1) * BOOKS_PER_PAGE;
      let bookIds = null;

      if (quickFilter === 'continue_reading') {
        bookIds = continueReadingBooks.map(b => b.book_id);
      } else if (quickFilter === 'recently_read') {
        bookIds = recentlyReadBooks.map(b => b.book_id);
      } else if (quickFilter === 'recently_added') {
        // Will filter client-side for now
      }

      // Convert sortBy format
      let [sortField, sortDirection] = sortBy.split('_');
      if (sortField === 'added') sortField = 'added_at';
      if (sortField === 'rating') sortField = 'average_rating';
      const sortOrder = sortDirection?.toUpperCase() || 'DESC';

      if (bookIds && bookIds.length > 0) {
        const response = await booksAPI.getAll(1000, 0, sortField, sortOrder, filters);
        const filteredBooks = response.data.books.filter(book => bookIds.includes(book.id));
        setBooks(filteredBooks.slice(offset, offset + limit));
        setTotalBooks(filteredBooks.length);
      } else if (quickFilter === 'recently_added') {
        const response = await booksAPI.getAll(1000, 0, 'added_at', 'DESC', filters);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const filteredBooks = response.data.books.filter(book => new Date(book.added_at) >= thirtyDaysAgo);
        setBooks(filteredBooks.slice(offset, offset + limit));
        setTotalBooks(filteredBooks.length);
      } else {
        if (searchQuery.trim()) {
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
      if (!response?.data?.progress || !Array.isArray(response.data.progress)) {
        setReadingProgress({});
        return;
      }
      const progressMap = {};
      response.data.progress.forEach(p => {
        progressMap[p.book_id] = p;
      });
      setReadingProgress(progressMap);
    } catch (error) {
      console.error('Error loading reading progress:', error);
      setReadingProgress({});
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
      .sort((a, b) => b[1] - a[1])
      .map(([author, count]) => ({ author, count }));
  }, [allBooksForFilters]);

  // Calculate genre counts
  const genreCounts = useMemo(() => {
    const counts = {};
    allBooksForFilters.forEach(book => {
      if (book.categories) {
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
        const year = book.published_date.split('-')[0];
        if (year && year.length === 4) {
          counts[year] = (counts[year] || 0) + 1;
        }
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, count]) => ({ year, count }));
  }, [allBooksForFilters]);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadBooks();
  };

  const handleAdvancedSearch = (criteria) => {
    setAdvancedSearchCriteria(criteria);
    setAdvancedSearchOpen(false);
    setCurrentPage(1);
  };

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
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
    const bookFiles = files.filter(f =>
      ['.epub', '.pdf', '.mobi'].some(ext => f.name.toLowerCase().endsWith(ext))
    );

    if (bookFiles.length === 0) {
      setUploadError('No supported book files found. Supports EPUB, PDF, and MOBI.');
      setTimeout(() => setUploadError(null), 5000);
      return;
    }

    for (const file of bookFiles) {
      try {
        setUploadProgress(`Uploading ${file.name}...`);
        const formData = new FormData();
        formData.append('book', file);
        await booksAPI.upload(file);
        setUploadProgress(`Successfully uploaded ${file.name}`);
      } catch (error) {
        setUploadError(`Failed to upload ${file.name}: ${error.message}`);
        setTimeout(() => setUploadError(null), 5000);
      }
    }

    setTimeout(() => setUploadProgress(null), 3000);
    loadBooks();
    loadAllBooksForFilters();
  };

  const totalPages = Math.ceil(totalBooks / BOOKS_PER_PAGE);

  // ==========================================
  // Filter Sidebar Content (shared between mobile & desktop drawers)
  // ==========================================
  const filterContent = (
    <Box sx={{ overflow: 'auto', p: 2 }}>
      {/* Filter Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <FilterIcon sx={{ mr: 1, color: '#e50914' }} />
          <Typography variant="h6">Filters</Typography>
        </Box>
        {/* Close button only on mobile */}
        {isMobile && (
          <IconButton onClick={() => setMobileFilterOpen(false)} sx={{ color: 'rgba(255,255,255,0.7)' }}>
            <CloseIcon />
          </IconButton>
        )}
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
          {/* Clear All on mobile for convenience */}
          {isMobile && (
            <Button
              size="small"
              onClick={() => {
                setSelectedAuthor(null);
                setSelectedGenre(null);
                setSelectedSeries(null);
                setSelectedYear(null);
              }}
              sx={{ mt: 1, color: '#e50914', fontSize: '0.75rem' }}
            >
              Clear All Filters
            </Button>
          )}
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
                  onClick={() => {
                    setSelectedAuthor(selectedAuthor === author ? null : author);
                    if (isMobile) setMobileFilterOpen(false);
                  }}
                  sx={{
                    py: 0.5,
                    px: 2,
                    // Larger touch target on mobile
                    ...(isMobile && { py: 1 }),
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
                      onClick={() => {
                        setSelectedGenre(selectedGenre === genre ? null : genre);
                        if (isMobile) setMobileFilterOpen(false);
                      }}
                      sx={{
                        py: 0.5,
                        px: 2,
                        ...(isMobile && { py: 1 }),
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
                      onClick={() => {
                        setSelectedSeries(selectedSeries === series ? null : series);
                        if (isMobile) setMobileFilterOpen(false);
                      }}
                      sx={{
                        py: 0.5,
                        px: 2,
                        ...(isMobile && { py: 1 }),
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
                    onClick={() => {
                      setSelectedYear(selectedYear === year ? null : year);
                      if (isMobile) setMobileFilterOpen(false);
                    }}
                    sx={{
                      py: 0.5,
                      px: 2,
                      ...(isMobile && { py: 1 }),
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
  );

  return (
    <Box
      sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0f0f0f' }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Overlay */}
      {isDragging && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(229, 9, 20, 0.15)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '3px dashed #e50914',
            pointerEvents: 'none',
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <LibraryIcon sx={{ fontSize: isSmall ? 60 : 100, mb: 2 }} />
            <Typography variant={isSmall ? 'h5' : 'h3'} gutterBottom>
              Drop Books Here
            </Typography>
            <Typography variant={isSmall ? 'body2' : 'h6'}>
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
            bottom: isMobile ? 80 : 20,
            right: 20,
            left: isMobile ? 20 : 'auto',
            backgroundColor: '#1a1a1a',
            padding: 2,
            borderRadius: 1,
            zIndex: 10000,
            minWidth: isMobile ? 'auto' : 300,
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
            bottom: isMobile ? 80 : 20,
            right: 20,
            left: isMobile ? 20 : 'auto',
            backgroundColor: '#e50914',
            padding: 2,
            borderRadius: 1,
            zIndex: 10000,
            minWidth: isMobile ? 'auto' : 300,
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          }}
        >
          <Typography variant="body1">{uploadError}</Typography>
        </Box>
      )}

      {/* ==========================================
          FILTER SIDEBAR - Desktop: permanent, Mobile: swipeable overlay
         ========================================== */}
      {isMobile ? (
        <SwipeableDrawer
          anchor="left"
          open={mobileFilterOpen}
          onClose={() => setMobileFilterOpen(false)}
          onOpen={() => setMobileFilterOpen(true)}
          disableSwipeToOpen={false}
          swipeAreaWidth={20}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              backgroundColor: '#1a1a1a',
              borderRight: '1px solid #333',
            },
          }}
        >
          {filterContent}
        </SwipeableDrawer>
      ) : (
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
              marginTop: '64px',
            },
          }}
        >
          {filterContent}
        </Drawer>
      )}

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: isMobile ? '100%' : `calc(100% - ${DRAWER_WIDTH}px)`,
          // Add bottom padding on mobile for bottom nav
          pb: isMobile ? '80px' : 0,
        }}
      >
        {/* ==========================================
            APP BAR - Responsive
           ========================================== */}
        <AppBar 
          position="fixed" 
          sx={{ 
            backgroundColor: '#1a1a1a', 
            zIndex: (theme) => theme.zIndex.drawer + 1,
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
            {/* Mobile: Filter toggle button */}
            {isMobile && (
              <IconButton
                edge="start"
                color="inherit"
                onClick={() => setMobileFilterOpen(true)}
                sx={{ mr: 1 }}
              >
                <Badge 
                  badgeContent={activeFilterCount} 
                  color="error"
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }}
                >
                  <FilterIcon />
                </Badge>
              </IconButton>
            )}

            <LibraryIcon sx={{ mr: 1, display: { xs: 'none', sm: 'block' } }} />
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                flexGrow: 1,
                fontSize: { xs: '1rem', sm: '1.25rem' },
              }}
            >
              BookServe
            </Typography>

            {/* Desktop nav buttons - hidden on mobile (use bottom nav instead) */}
            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
              <AdminNavButton />
              <Button
                color="inherit"
                startIcon={<CollectionsIcon />}
                onClick={() => navigate('/collections')}
                sx={{ mr: 2 }}
              >
                Collections
              </Button>
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
              {/*<Button
                color="inherit"
                onClick={() => navigate('/my-requests')}
                sx={{ mr: 2 }}
              >
                My Requests
              </Button>*/}
              <Button
                color="inherit"
                startIcon={<EmojiEvents />}
                onClick={() => navigate('/bestsellers')}
                sx={{ mr: 2 }}
              >
                NYT Bestsellers
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
            </Box>

            {/* Tablet: Show compact icons for key actions */}
            <Box sx={{ display: { xs: 'none', sm: 'flex', md: 'none' }, alignItems: 'center', gap: 0.5 }}>
              <AdminNavButton />
              <IconButton color="inherit" onClick={() => navigate('/collections')} title="Collections">
                <CollectionsIcon />
              </IconButton>
              <IconButton color="inherit" onClick={() => navigate('/request')}>
                <AddIcon />
              </IconButton>
              <IconButton color="inherit" onClick={() => navigate('/reading-list')}>
                <ReadIcon />
              </IconButton>
              <IconButton color="inherit" onClick={() => navigate('/ai/recommendations')}>
                <AIIcon />
              </IconButton>
            </Box>

            <UserMenu onLogout={onLogout} />
          </Toolbar>
        </AppBar>

        <Container 
          maxWidth="xl" 
          sx={{ 
            mt: { xs: 8, sm: 10 }, 
            pb: 4,
            px: { xs: 1.5, sm: 2, md: 3 },
          }}
        >
          {/* Search Bar */}
          <Box component="form" onSubmit={handleSearch} sx={{ mb: { xs: 2, sm: 4 } }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder={isSmall ? "Search books..." : "Search books by title, author, or ISBN..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size={isSmall ? 'small' : 'medium'}
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
                        fontSize: { xs: '0.7rem', sm: '0.8125rem' },
                        px: { xs: 1, sm: 2 },
                        minWidth: { xs: 'auto', sm: 64 },
                        '&:hover': {
                          borderColor: '#b20710',
                          backgroundColor: 'rgba(229, 9, 20, 0.1)',
                        },
                      }}
                    >
                      {isSmall ? 'Adv.' : 'Advanced Search'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={!isSmall ? <FullTextSearchIcon /> : undefined}
                      onClick={() => navigate('/search')}
                      sx={{
                        borderColor: '#e50914',
                        color: '#e50914',
                        fontSize: { xs: '0.7rem', sm: '0.8125rem' },
                        px: { xs: 1, sm: 2 },
                        ml: 0.5,
                        minWidth: { xs: 'auto', sm: 64 },
                        '&:hover': {
                          borderColor: '#b20710',
                          backgroundColor: 'rgba(229, 9, 20, 0.1)',
                        },
                      }}
                    >
                      {isSmall ? <FullTextSearchIcon sx={{ fontSize: 18 }} /> : 'Search Inside Books'}
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

          {/* Quick Filters - horizontally scrollable on mobile */}
          <Box 
            sx={{ 
              mb: { xs: 2, sm: 3 }, 
              display: 'flex', 
              gap: 1, 
              flexWrap: { xs: 'nowrap', sm: 'wrap' },
              overflowX: { xs: 'auto', sm: 'visible' },
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              pb: { xs: 0.5, sm: 0 },
            }}
          >
            <Chip
              label="All Books"
              onClick={() => setQuickFilter('all')}
              color={quickFilter === 'all' ? 'primary' : 'default'}
              sx={{
                backgroundColor: quickFilter === 'all' ? '#e50914' : '#1a1a1a',
                flexShrink: 0,
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
                flexShrink: 0,
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
                flexShrink: 0,
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
                flexShrink: 0,
                '&:hover': {
                  backgroundColor: quickFilter === 'recently_added' ? '#b20710' : '#333',
                },
              }}
            />
          </Box>

          {/* Active mobile filter chips (shown inline when filters are active on mobile) */}
          {isMobile && activeFilterCount > 0 && (
            <Box sx={{ mb: 2, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {selectedAuthor && (
                <Chip
                  label={`${selectedAuthor}`}
                  onDelete={() => setSelectedAuthor(null)}
                  size="small"
                  sx={{ backgroundColor: '#e50914', '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)' } }}
                />
              )}
              {selectedGenre && (
                <Chip
                  label={`${selectedGenre}`}
                  onDelete={() => setSelectedGenre(null)}
                  size="small"
                  sx={{ backgroundColor: '#e50914', '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)' } }}
                />
              )}
              {selectedSeries && (
                <Chip
                  label={`${selectedSeries}`}
                  onDelete={() => setSelectedSeries(null)}
                  size="small"
                  sx={{ backgroundColor: '#e50914', '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)' } }}
                />
              )}
              {selectedYear && (
                <Chip
                  label={`${selectedYear}`}
                  onDelete={() => setSelectedYear(null)}
                  size="small"
                  sx={{ backgroundColor: '#e50914', '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)' } }}
                />
              )}
            </Box>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <LinearProgress sx={{ width: '50%' }} />
            </Box>
          ) : books.length === 0 ? (
            <Box sx={{ textAlign: 'center', mt: 8 }}>
              <LibraryIcon sx={{ fontSize: isSmall ? 60 : 100, color: 'rgba(255,255,255,0.1)', mb: 2 }} />
              <Typography variant={isSmall ? 'h6' : 'h5'} color="text.secondary" gutterBottom>
                {selectedAuthor || selectedGenre || selectedSeries || selectedYear || searchQuery
                  ? 'No books match your filters' : 'No books found'}
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
              {/* Library header + controls */}
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                mb: { xs: 2, sm: 3 }, 
                flexWrap: 'wrap', 
                gap: { xs: 1, sm: 2 },
              }}>
                <Typography variant={isSmall ? 'h6' : 'h5'} gutterBottom sx={{ mb: 0 }}>
                  {selectedAuthor ? (
                    <>Books by {selectedAuthor} ({totalBooks})</>
                  ) : (
                    <>Your Library ({totalBooks} book{totalBooks !== 1 ? 's' : ''})</>
                  )}
                </Typography>
                
                <Box sx={{ display: 'flex', gap: { xs: 1, sm: 2 }, alignItems: 'center', flexWrap: 'wrap' }}>
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
                      size={isSmall ? 'small' : 'medium'}
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
                      size={isSmall ? 'small' : 'medium'}
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

                  {/* Sort */}
                  <FormControl size="small" sx={{ minWidth: { xs: 100, sm: 150 } }}>
                    <Select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      displayEmpty
                      startAdornment={
                        <InputAdornment position="start">
                          <SortIcon sx={{ fontSize: '1.2rem' }} />
                        </InputAdornment>
                      }
                      sx={{
                        backgroundColor: '#1a1a1a',
                        fontSize: { xs: '0.75rem', sm: '0.875rem' },
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#333',
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

                  {/* Refresh & Import - hide on small mobile */}
                  <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<RefreshIcon />}
                      onClick={handleRefreshAllMetadata}
                      disabled={refreshingMetadata}
                      sx={{
                        borderColor: '#333',
                        color: '#fff',
                        '&:hover': {
                          borderColor: '#e50914',
                        },
                      }}
                    >
                      {refreshingMetadata ? 'Refreshing...' : 'Refresh Covers'}
                    </Button>

                    <Button
                      variant="outlined"
                      onClick={() => setGoodreadsImportOpen(true)}
                      size="small"
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
              </Box>

              {/* Book Display - Grid or List View */}
              {viewMode === 'grid' ? (
                books.length > 50 ? (
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
                  <Grid container spacing={{ xs: 1.5, sm: 2, md: 3 }}>
                    {books.map((book) => (
                      <Grid item xs={6} sm={4} md={4} lg={3} xl={2} key={book.id}>
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
                /* List view - use simplified card layout on mobile instead of table */
                isSmall ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {books.map((book) => {
                      const progress = readingProgress[book.id];
                      return (
                        <Paper
                          key={book.id}
                          sx={{
                            backgroundColor: '#1a1a1a',
                            p: 1.5,
                            display: 'flex',
                            gap: 1.5,
                            alignItems: 'center',
                            cursor: 'pointer',
                            '&:active': {
                              backgroundColor: 'rgba(229, 9, 20, 0.05)',
                            },
                          }}
                          onClick={() => {
                            setSelectedBookForDetail(book);
                            setBookDetailOpen(true);
                          }}
                        >
                          <Avatar
                            src={book.cover_image ? booksAPI.getCoverUrl(book.id) : undefined}
                            variant="rounded"
                            sx={{ width: 50, height: 70 }}
                          >
                            {book.title?.[0]}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                              {book.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {book.author}
                            </Typography>
                            {progress && progress.progress > 0 && (
                              <LinearProgress
                                variant="determinate"
                                value={progress.progress}
                                sx={{
                                  mt: 0.5,
                                  height: 3,
                                  borderRadius: 1,
                                  backgroundColor: '#333',
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor: progress.progress === 100 ? '#4caf50' : '#e50914',
                                  },
                                }}
                              />
                            )}
                          </Box>
                          {book.average_rating > 0 && (
                            <Rating value={book.average_rating} readOnly size="small" precision={0.5} />
                          )}
                        </Paper>
                      );
                    })}
                  </Box>
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
                                cursor: 'pointer',
                                '&:hover': {
                                  backgroundColor: 'rgba(229, 9, 20, 0.05)',
                                },
                              }}
                              onClick={() => {
                                setSelectedBookForDetail(book);
                                setBookDetailOpen(true);
                              }}
                            >
                              <TableCell>
                                <Avatar
                                  src={book.cover_image ? booksAPI.getCoverUrl(book.id) : undefined}
                                  variant="rounded"
                                  sx={{ width: 40, height: 56 }}
                                >
                                  {book.title?.[0]}
                                </Avatar>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {book.title}
                                </Typography>
                              </TableCell>
                              <TableCell>{book.author}</TableCell>
                              <TableCell>
                                {book.average_rating > 0 && (
                                  <Rating value={book.average_rating} readOnly size="small" precision={0.5} />
                                )}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={book.format?.toUpperCase() || '?'}
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
                                        width: 60,
                                        height: 6,
                                        borderRadius: 3,
                                        backgroundColor: '#333',
                                        '& .MuiLinearProgress-bar': {
                                          backgroundColor: progress.progress === 100 ? '#4caf50' : '#e50914',
                                        },
                                      }}
                                    />
                                    <Typography variant="caption">
                                      {Math.round(progress.progress)}%
                                    </Typography>
                                  </Box>
                                ) : '-'}
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption">
                                  {new Date(book.added_at).toLocaleDateString()}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/read/${book.id}`);
                                  }}
                                  title="Read"
                                >
                                  <ReadIcon />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(booksAPI.getDownloadUrl(book.id), '_blank');
                                  }}
                                  title="Download"
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
                )
              )}

              {/* Pagination - responsive */}
              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <Pagination
                    count={totalPages}
                    page={currentPage}
                    onChange={handlePageChange}
                    color="primary"
                    size={isSmall ? 'small' : 'large'}
                    showFirstButton={!isSmall}
                    showLastButton={!isSmall}
                    siblingCount={isSmall ? 0 : 1}
                    sx={{
                      '& .MuiPaginationItem-root': {
                        color: '#fff',
                        borderColor: '#333',
                        minWidth: { xs: 28, sm: 32 },
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
          loadBooks();
          loadAllBooksForFilters();
        }}
      />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

      {/* iOS PWA Install Prompt */}
      <IOSInstallPrompt />
    </Box>
  );
};

export default Dashboard;
