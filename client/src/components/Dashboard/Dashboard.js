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
} from '@mui/material';
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
} from '@mui/icons-material';
import { booksAPI, metadataAPI } from '../../services/api';
import BookCard from './BookCard';

const DRAWER_WIDTH = 280;
const BOOKS_PER_PAGE = 24;

const Dashboard = ({ onLogout }) => {
  const navigate = useNavigate();
  const [allBooks, setAllBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [displayedBooks, setDisplayedBooks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshingMetadata, setRefreshingMetadata] = useState(false);
  const [authorFilterOpen, setAuthorFilterOpen] = useState(true);
  const [sortBy, setSortBy] = useState('added_desc');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadBooks();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allBooks, selectedAuthor, searchQuery, sortBy]);

  useEffect(() => {
    applyPagination();
  }, [filteredBooks, currentPage]);

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [selectedAuthor, searchQuery, sortBy]);

  const loadBooks = async () => {
    try {
      setLoading(true);
      // Fetch all books with a high limit to ensure we get everything
      const response = await booksAPI.getAll(10000, 0);
      setAllBooks(response.data.books);
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate author counts
  const authorCounts = useMemo(() => {
    const counts = {};
    allBooks.forEach(book => {
      const author = book.author || 'Unknown Author';
      counts[author] = (counts[author] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .map(([author, count]) => ({ author, count }));
  }, [allBooks]);

  const applyFilters = () => {
    let filtered = [...allBooks];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(book =>
        book.title?.toLowerCase().includes(query) ||
        book.author?.toLowerCase().includes(query) ||
        book.isbn?.toLowerCase().includes(query)
      );
    }

    // Apply author filter
    if (selectedAuthor) {
      filtered = filtered.filter(book => 
        (book.author || 'Unknown Author') === selectedAuthor
      );
    }

    // Apply sorting
    filtered = sortBooks(filtered);

    setFilteredBooks(filtered);
  };

  const sortBooks = (books) => {
    const sorted = [...books];
    
    switch (sortBy) {
      case 'title_asc':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'title_desc':
        return sorted.sort((a, b) => b.title.localeCompare(a.title));
      case 'author_asc':
        return sorted.sort((a, b) => 
          (a.author || 'Unknown').localeCompare(b.author || 'Unknown')
        );
      case 'author_desc':
        return sorted.sort((a, b) => 
          (b.author || 'Unknown').localeCompare(a.author || 'Unknown')
        );
      case 'rating_desc':
        return sorted.sort((a, b) => 
          (b.average_rating || 0) - (a.average_rating || 0)
        );
      case 'rating_asc':
        return sorted.sort((a, b) => 
          (a.average_rating || 0) - (b.average_rating || 0)
        );
      case 'added_desc':
        return sorted.sort((a, b) => 
          new Date(b.added_at) - new Date(a.added_at)
        );
      case 'added_asc':
        return sorted.sort((a, b) => 
          new Date(a.added_at) - new Date(b.added_at)
        );
      default:
        return sorted;
    }
  };

  const applyPagination = () => {
    const startIndex = (currentPage - 1) * BOOKS_PER_PAGE;
    const endIndex = startIndex + BOOKS_PER_PAGE;
    setDisplayedBooks(filteredBooks.slice(startIndex, endIndex));
  };

  const totalPages = Math.ceil(filteredBooks.length / BOOKS_PER_PAGE);

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    // Search is now handled by useEffect
  };

  const handleAuthorClick = (author) => {
    setSelectedAuthor(selectedAuthor === author ? null : author);
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

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0f0f0f' }}>
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
          {selectedAuthor && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Active Filters:
              </Typography>
              <Chip
                label={selectedAuthor}
                onDelete={() => setSelectedAuthor(null)}
                size="small"
                sx={{ 
                  backgroundColor: '#e50914',
                  '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.7)' }
                }}
              />
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
              <List sx={{ maxHeight: '500px', overflow: 'auto', pt: 0 }}>
                {authorCounts.map(({ author, count }) => (
                  <ListItem key={author} disablePadding>
                    <ListItemButton
                      selected={selectedAuthor === author}
                      onClick={() => handleAuthorClick(author)}
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
          ) : filteredBooks.length === 0 ? (
            <Box sx={{ textAlign: 'center', mt: 8 }}>
              <Typography variant="h5" color="text.secondary" gutterBottom>
                {selectedAuthor || searchQuery ? 'No books match your filters' : 'No books found'}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {selectedAuthor || searchQuery 
                  ? 'Try adjusting your filters or search term' 
                  : 'Start building your library by requesting books!'}
              </Typography>
              {(selectedAuthor || searchQuery) && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setSelectedAuthor(null);
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
                      Books by {selectedAuthor} ({filteredBooks.length})
                    </>
                  ) : (
                    <>
                      Your Library ({filteredBooks.length} book{filteredBooks.length !== 1 ? 's' : ''})
                    </>
                  )}
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
                </Box>
              </Box>

              {/* Book Grid */}
              <Grid container spacing={3}>
                {displayedBooks.map((book) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={book.id}>
                    <BookCard book={book} onUpdate={loadBooks} />
                  </Grid>
                ))}
              </Grid>

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
    </Box>
  );
};

export default Dashboard;
