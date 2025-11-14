import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Container,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { requestsAPI } from '../../services/api';

const MyRequests = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
    // Poll for updates every 30 seconds
    const interval = setInterval(loadRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadRequests = async () => {
    try {
      const response = await requestsAPI.getMyRequests();
      setRequests(response.data.requests);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'warning',
      searching: 'info',
      downloading: 'info',
      completed: 'success',
      failed: 'error',
    };
    return colors[status] || 'default';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#0f0f0f' }}>
      <AppBar position="static" sx={{ backgroundColor: '#1a1a1a' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" component="div">
            My Book Requests
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, pb: 4 }}>
        {loading ? (
          <Typography variant="h6" align="center" color="text.secondary">
            Loading requests...
          </Typography>
        ) : requests.length === 0 ? (
          <Box sx={{ textAlign: 'center', mt: 8 }}>
            <Typography variant="h6" color="text.secondary">
              No book requests yet
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ backgroundColor: '#1a1a1a' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Author</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Requested</TableCell>
                  <TableCell>Completed</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{request.title}</TableCell>
                    <TableCell>{request.author || 'Unknown'}</TableCell>
                    <TableCell>
                      <Chip
                        label={request.status.toUpperCase()}
                        color={getStatusColor(request.status)}
                        size="small"
                      />
                      {request.error_message && (
                        <Typography variant="caption" color="error" display="block">
                          {request.error_message}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(request.requested_at)}</TableCell>
                    <TableCell>
                      {request.completed_at ? formatDate(request.completed_at) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>
    </Box>
  );
};

export default MyRequests;
