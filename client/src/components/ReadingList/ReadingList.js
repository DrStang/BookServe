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
} from '@mui/material';
import {
  MenuBook as BookIcon,
  CheckCircle as AvailableIcon,
  HourglassEmpty as PendingIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { goodreadsAPI, requestsAPI, progressAPI } from '../../services/api';

const ReadingList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [availableBooks, setAvailableBooks] = useState([]);
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

      // Load books imported from Goodreads with "to-read" shelf
      const importedRes = await goodreadsAPI.getImportedBooks('to-read');
      const importedBooks = importedRes.data.books;

      // Filter out books that have been started (>5% progress)
      const toReadBooks = importedBooks.filter(book => {
        const progress = progressMap[book.id];
        return !progress || progress.progress < 5;
      });
      setAvailableBooks(toReadBooks);

      // Load pending requests (these are books not in library)
      const requestsRes = await requestsAPI.getMyRequests();
      const pending = requestsRes.data.requests.filter(r => r.status === 'pending');
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BookIcon sx={{ fontSize: 40 }} />
          My Reading List
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Books you want to read from your Goodreads import
        </Typography>
      </Box>

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
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AvailableIcon />
                Available ({availableBooks.length})
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PendingIcon />
                Pending Requests ({pendingRequests.length})
              </Box>
            }
          />
        </Tabs>

        {/* Available Books Tab */}
        {activeTab === 0 && (
          <Box sx={{ p: 3 }}>
            {availableBooks.length === 0 ? (
              <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No available books in your reading list. Import your Goodreads library to get started!
              </Typography>
            ) : (
              <List>
                {availableBooks.map((book, index) => (
                  <React.Fragment key={book.id}>
                    <ListItem
                      sx={{
                        py: 2,
                        '&:hover': {
                          backgroundColor: 'rgba(229, 9, 20, 0.05)',
                        },
                      }}
                      secondaryAction={
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          {book.average_rating && (
                            <Chip
                              label={`⭐ ${book.average_rating.toFixed(1)}`}
                              size="small"
                              sx={{ backgroundColor: '#333' }}
                            />
                          )}
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => navigate(`/read/${book.id}`)}
                            sx={{
                              backgroundColor: '#e50914',
                              '&:hover': { backgroundColor: '#b20710' },
                            }}
                          >
                            Read Now
                          </Button>
                        </Box>
                      }
                    >
                      <ListItemText
                        primary={
                          <Typography variant="h6" sx={{ cursor: 'pointer' }}>
                            {book.title}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              by {book.author || 'Unknown Author'}
                            </Typography>
                            {book.categories && (
                              <Typography variant="caption" color="text.secondary">
                                {book.categories}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < availableBooks.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
        )}

        {/* Pending Requests Tab */}
        {activeTab === 1 && (
          <Box sx={{ p: 3 }}>
            {pendingRequests.length === 0 ? (
              <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No pending book requests. All your to-read books are available!
              </Typography>
            ) : (
              <List>
                {pendingRequests.map((request, index) => (
                  <React.Fragment key={request.id}>
                    <ListItem
                      sx={{
                        py: 2,
                        '&:hover': {
                          backgroundColor: 'rgba(229, 9, 20, 0.05)',
                        },
                      }}
                      secondaryAction={
                        <Chip
                          label={request.status}
                          size="small"
                          color={request.status === 'pending' ? 'warning' : 'success'}
                        />
                      }
                    >
                      <ListItemText
                        primary={
                          <Typography variant="h6">
                            {request.title}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              by {request.author || 'Unknown Author'}
                            </Typography>
                            {request.isbn && (
                              <Typography variant="caption" color="text.secondary">
                                ISBN: {request.isbn}
                              </Typography>
                            )}
                            {request.notes && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                {request.notes}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              Requested: {new Date(request.created_at).toLocaleDateString()}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < pendingRequests.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default ReadingList;
