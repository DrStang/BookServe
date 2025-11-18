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
  TablePagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Search as SearchIcon,
  Logout as LogoutIcon,
  Add as AddIcon,
  LibraryBooks as LibraryIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { booksAPI, metadataAPI } from '../../services/api';
import BookCard from './BookCard';

const Dashboard = ({ onLogout }) => {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshingMetadata, setRefreshingMetadata] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(24);
  const [totalBooks, setTotalBooks] = useState(0);

  // Sort and filter states
  const [sortBy, setSortBy] = useState('added_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [filterAuthor, setFilterAuthor] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterPublisher, setFilterPublisher] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterFormat, setFilterFormat] = useState('');

  useEffect(() => {
    loadBooks();
  }, [page, rowsPerPage, sortBy, sortOrder, filterAuthor, filterYear, filterPublisher, filterLanguage, filterFormat]);

  const loadBooks = async () => {
    try {
      setLoading(true);
      const offset = page * rowsPerPage;

      // Build filters object
      const filters = {};
      if (filterAuthor) filters.author = filterAuthor;
      if (filterYear) filters.year = filterYear;
      if (filterPublisher) filters.publisher = filterPublisher;
      if (filterLanguage) filters.language = filterLanguage;
      if (filterFormat) filters.format = filterFormat;

      const response = await booksAPI.getAll(rowsPerPage, offset, sortBy, sortOrder, filters);
      setBooks(response.data.books);
      setTotalBooks(response.data.total);
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setPage(0);
      loadBooks();
      return;
    }

    try {
      setLoading(true);
      setPage(0);
      const response = await booksAPI.search(searchQuery);
      setBooks(response.data.books);
      setTotalBooks(response.data.books.length);
    } catch (error) {
      console.error('Error searching books:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
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

        {/* Sort and Filter Controls */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Sort & Filter
          </Typography>
          <Grid container spacing={2}>
            {/* Sort By */}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort By"
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setPage(0);
                  }}
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
                  <MenuItem value="title">Title</MenuItem>
                  <MenuItem value="author">Author</MenuItem>
                  <MenuItem value="added_at">Date Added</MenuItem>
                  <MenuItem value="published_date">Publication Date</MenuItem>
                  <MenuItem value="average_rating">Rating</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Sort Order */}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Order</InputLabel>
                <Select
                  value={sortOrder}
                  label="Order"
                  onChange={(e) => {
                    setSortOrder(e.target.value);
                    setPage(0);
                  }}
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
                  <MenuItem value="ASC">Ascending (A-Z, Old-New)</MenuItem>
                  <MenuItem value="DESC">Descending (Z-A, New-Old)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Filter by Author */}
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Filter by Author"
                value={filterAuthor}
                onChange={(e) => {
                  setFilterAuthor(e.target.value);
                  setPage(0);
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
            </Grid>

            {/* Filter by Year */}
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Filter by Year"
                value={filterYear}
                onChange={(e) => {
                  setFilterYear(e.target.value);
                  setPage(0);
                }}
                placeholder="e.g., 2023"
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
            </Grid>

            {/* Filter by Publisher */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Filter by Publisher"
                value={filterPublisher}
                onChange={(e) => {
                  setFilterPublisher(e.target.value);
                  setPage(0);
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
            </Grid>

            {/* Filter by Language */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Filter by Language"
                value={filterLanguage}
                onChange={(e) => {
                  setFilterLanguage(e.target.value);
                  setPage(0);
                }}
                placeholder="e.g., en"
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
            </Grid>

            {/* Filter by Format */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth>
                <InputLabel>Filter by Format</InputLabel>
                <Select
                  value={filterFormat}
                  label="Filter by Format"
                  onChange={(e) => {
                    setFilterFormat(e.target.value);
                    setPage(0);
                  }}
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
                  <MenuItem value="">All Formats</MenuItem>
                  <MenuItem value="epub">EPUB</MenuItem>
                  <MenuItem value="pdf">PDF</MenuItem>
                  <MenuItem value="mobi">MOBI</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Clear Filters Button */}
            <Grid item xs={12}>
              <Button
                variant="outlined"
                onClick={() => {
                  setFilterAuthor('');
                  setFilterYear('');
                  setFilterPublisher('');
                  setFilterLanguage('');
                  setFilterFormat('');
                  setSortBy('added_at');
                  setSortOrder('DESC');
                  setPage(0);
                }}
                sx={{
                  borderColor: '#e50914',
                  color: '#e50914',
                  '&:hover': {
                    borderColor: '#e50914',
                    backgroundColor: 'rgba(229, 9, 20, 0.1)',
                  },
                }}
              >
                Clear All Filters
              </Button>
            </Grid>
          </Grid>
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>

              <Typography variant="h5" gutterBottom sx={{ mb: 0 }}>

                Your Library ({totalBooks} books)

              </Typography>

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

                {refreshingMetadata ? 'Refreshing All...' : 'Refresh All Covers'}

              </Button>

            </Box>
            <Grid container spacing={3}>
              {books.map((book) => (
                <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={book.id}>
                  <BookCard book={book} onUpdate={loadBooks} />
                </Grid>
              ))}
            </Grid>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <TablePagination
                component="div"
                count={totalBooks}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[12, 24, 48, 96]}
                labelRowsPerPage="Books per page:"
                sx={{
                  color: '#fff',
                  '& .MuiTablePagination-select': {
                    color: '#fff',
                  },
                  '& .MuiTablePagination-selectIcon': {
                    color: '#fff',
                  },
                  '& .MuiTablePagination-displayedRows': {
                    color: '#fff',
                  },
                  '& .MuiIconButton-root': {
                    color: '#fff',
                  },
                }}
              />
            </Box>
          </>
        )}
      </Container>
    </Box>
  );
};

export default Dashboard;
