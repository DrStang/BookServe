import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  Button,
  Chip,
  Divider,
  CircularProgress,
  AppBar,
  Toolbar,
  IconButton,
  Grid,
  Card,
  CardContent,
  CardActions,
  CardMedia,
  Avatar,
} from '@mui/material';
import {
  MenuBook as BookIcon,
  CheckCircle as AvailableIcon,
  HourglassEmpty as PendingIcon,
  AutoStories as ReadingIcon,
  Done as ReadIcon,
  ArrowBack as BackIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { goodreadsAPI, requestsAPI, progressAPI, booksAPI } from '../../services/api';

const ReadingList = ({ onLogout }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [shelfBooks, setShelfBooks] = useState({
    'to-read': [],
    'currently-reading': [],
    'read': [],
  });
  const [stats, setStats] = useState({
    total: 0,
    'to-read': 0,
    'currently-reading': 0,
    'read': 0,
  });
  const [pendingRequests, setPendingRequests] = useState([]);
  const [readingProgress, setReadingProgress] = useState({});

  useEffect(() => {
    loadReadingList();
  }, []);

  const loadReadingList = async () => {
    try {
      setLoading(true);

      // Load reading progress to identify started books
      const progressRes = await progressAPI.getAllProgress();
      const progressMap = {};
      progressRes.data.progress.forEach(p => {
        progressMap[p.book_id] = p;
      });
      setReadingProgress(progressMap);

      // Load books from each shelf
      const shelves = ['to-read', 'currently-reading', 'read'];
      const shelfData = {};
      const statsData = { total: 0, 'to-read': 0, 'currently-reading': 0, 'read': 0 };

      for (const shelf of shelves) {
        const response = await goodreadsAPI.getImportedBooks(shelf);
        shelfData[shelf] = response.data.books || [];
        statsData[shelf] = shelfData[shelf].length;
        statsData.total += shelfData[shelf].length;
      }

      setShelfBooks(shelfData);
      setStats(statsData);

      // Load pending requests for to-read books not in library
      const requestsRes = await requestsAPI.getMyRequests();
      const pending = requestsRes.data.requests.filter(
        r => ['pending', 'searching', 'downloading'].includes(r.status)
      );
      setPendingRequests(pending);

    } catch (error) {
      console.error('Error loading reading list:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleOpenBookDetail = (bookId) => {
    // Dispatch custom event to open book detail modal in Dashboard
    const event = new CustomEvent('openBookDetail', { 
      detail: { id: bookId } 
    });
    window.dispatchEvent(event);
    // Or navigate to the book detail page if you prefer
    // navigate(`/book/${bookId}`);
  };

  const renderBookCard = (book, isPending = false) => {
    const progress = readingProgress[book.id];
    const hasProgress = progress && progress.progress > 0;

    return (
      <Card
        key={book.id || book.title}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#1a1a1a',
          transition: 'transform 0.2s',
          '&:hover': {
            transform: 'scale(1.02)',
          },
        }}
      >
        {book.cover_image && (
          <CardMedia
            component="img"
            height="200"
            image={booksAPI.getCoverUrl(book.id)}
            alt={book.title}
            sx={{ objectFit: 'contain', bgcolor: '#2a2a2a', cursor: 'pointer' }}
            onClick={() => !isPending && handleOpenBookDetail(book.id)}
          />
        )}
        {!book.cover_image && (
          <Box
            sx={{
              height: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: '#2a2a2a',
            }}
          >
            <Avatar
              sx={{
                width: 120,
                height: 120,
                fontSize: 48,
                bgcolor: '#e50914',
              }}
            >
              {book.title[0]}
            </Avatar>
          </Box>
        )}

        <CardContent sx={{ flexGrow: 1 }}>
          <Typography
            variant="h6"
            gutterBottom
            noWrap
            sx={{
              cursor: isPending ? 'default' : 'pointer',
              '&:hover': !isPending ? { color: '#e50914' } : {},
            }}
            onClick={() => !isPending && handleOpenBookDetail(book.id)}
          >
            {book.title}
          </Typography>

          <Typography variant="body2" color="text.secondary" gutterBottom>
            by {book.author || 'Unknown Author'}
          </Typography>

          {/* Reading Progress for to-read books */}
          {hasProgress && (
            <Box sx={{ mt: 1 }}>
              <Chip
                label={`${Math.round(progress.progress)}% complete`}
                size="small"
                color="primary"
                sx={{ backgroundColor: '#e50914' }}
              />
            </Box>
          )}

          {/* Rating */}
          {book.average_rating && (
            <Box sx={{ mt: 1 }}>
              <Chip
                label={`⭐ ${book.average_rating.toFixed(1)}`}
                size="small"
                sx={{ backgroundColor: '#333' }}
              />
            </Box>
          )}

          {/* Categories */}
          {book.categories && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {book.categories.split(',').slice(0, 2).join(', ')}
            </Typography>
          )}

          {/* Status badge for pending requests */}
          {isPending && (
            <Box sx={{ mt: 2 }}>
              <Chip
                label={book.status || 'Pending'}
                size="small"
                color="warning"
                icon={<HourglassEmpty />}
              />
            </Box>
          )}
        </CardContent>

        <CardActions>
          {!isPending && (
            <>
              <Button
                size="small"
                startIcon={<InfoIcon />}
                onClick={() => handleOpenBookDetail(book.id)}
              >
                Details
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={() => navigate(`/read/${book.id}`)}
                sx={{
                  ml: 'auto',
                  backgroundColor: '#e50914',
                  '&:hover': { backgroundColor: '#b20710' },
                }}
              >
                {hasProgress ? 'Continue' : 'Read'}
              </Button>
            </>
          )}
        </CardActions>
      </Card>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const shelves = ['to-read', 'currently-reading', 'read'];
  const shelfIcons = {
    'to-read': <AvailableIcon />,
    'currently-reading': <ReadingIcon />,
    'read': <ReadIcon />,
  };
  const shelfLabels = {
    'to-read': 'To Read',
    'currently-reading': 'Currently Reading',
    'read': 'Read',
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#0f0f0f' }}>
      <AppBar position="static" sx={{ backgroundColor: '#1a1a1a' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, ml: 2 }}>
            My Reading List
          </Typography>
          {onLogout && (
            <Button color="inherit" onClick={onLogout}>
              Logout
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        {/* Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#1a1a1a' }}>
              <CardContent>
                <Typography variant="h4" sx={{ mb: 1 }}>
                  {stats.total}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Books
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#1a1a1a' }}>
              <CardContent>
                <Typography variant="h4" sx={{ mb: 1, color: '#4caf50' }}>
                  {stats['to-read']}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  To Read
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#1a1a1a' }}>
              <CardContent>
                <Typography variant="h4" sx={{ mb: 1, color: '#2196f3' }}>
                  {stats['currently-reading']}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Currently Reading
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#1a1a1a' }}>
              <CardContent>
                <Typography variant="h4" sx={{ mb: 1, color: '#9c27b0' }}>
                  {stats['read']}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Finished
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Paper sx={{ backgroundColor: '#1a1a1a' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': {
                color: 'text.secondary',
              },
              '& .Mui-selected': {
                color: '#e50914 !important',
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#e50914',
              },
            }}
          >
            {shelves.map((shelf, index) => (
              <Tab
                key={shelf}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {shelfIcons[shelf]}
                    {shelfLabels[shelf]} ({stats[shelf]})
                  </Box>
                }
              />
            ))}
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PendingIcon />
                  Pending Requests ({pendingRequests.length})
                </Box>
              }
            />
          </Tabs>

          <Box sx={{ p: 3 }}>
            {/* Regular shelf tabs */}
            {activeTab < 3 && (
              <>
                {shelfBooks[shelves[activeTab]].length === 0 ? (
                  <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    No books on this shelf. Import your Goodreads library from the Dashboard!
                  </Typography>
                ) : (
                  <Grid container spacing={3}>
                    {shelfBooks[shelves[activeTab]].map((book) => (
                      <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={book.id}>
                        {renderBookCard(book)}
                      </Grid>
                    ))}
                  </Grid>
                )}
              </>
            )}

            {/* Pending Requests Tab */}
            {activeTab === 3 && (
              <>
                {pendingRequests.length === 0 ? (
                  <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    No pending book requests. All your to-read books are available!
                  </Typography>
                ) : (
                  <Grid container spacing={3}>
                    {pendingRequests.map((request) => (
                      <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={request.id}>
                        {renderBookCard({
                          id: request.id,
                          title: request.title,
                          author: request.author,
                          status: request.status,
                          cover_image: null,
                        }, true)}
                      </Grid>
                    ))}
                  </Grid>
                )}
              </>
            )}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default ReadingList;
