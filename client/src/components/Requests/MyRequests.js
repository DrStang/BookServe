import React, { useState, useEffect, useCallback } from 'react';
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
  Tabs,
  Tab,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
} from '@mui/material';
import { 
  ArrowBack as BackIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { requestsAPI } from '../../services/api';
import { isAdmin as checkIsAdmin } from '../../utils/auth';

const MyRequests = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0); // 0 = My Requests, 1 = All Requests (admin only)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = checkIsAdmin();

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      let response;

      if (isAdmin && activeTab === 1) {
        response = await requestsAPI.getAllRequests();
      } else {
        response = await requestsAPI.getMyRequests();
      }
      
      setRequests(response.data.requests || []);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, activeTab]);
  
  useEffect(() => {
    loadRequests();
    // Poll for updates every 30 seconds
    const interval = setInterval(loadRequests, 30000);
    return () => clearInterval(interval);
  }, [loadRequests]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleDeleteClick = (request) => {
    setRequestToDelete(request);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!requestToDelete) return;

    setDeleting(true);
    try {
      await requestsAPI.delete(requestToDelete.id);
      setRequests(requests.filter(r => r.id !== requestToDelete.id));
      setDeleteDialogOpen(false);
      setRequestToDelete(null);
    } catch (error) {
      console.error('Error deleting request:', error);
    } finally {
      setDeleting(false);
    }
  };
  const canDelete = (request) => {
    if (isAdmin) return true;
    return ['pending', 'failed'].includes(request.status);
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
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const statusCounts = requests.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    acc.total = (acc.total || 0) + 1;
    return acc;
  }, {});  

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#0f0f0f' }}>
      <AppBar position="static" sx={{ backgroundColor: '#1a1a1a' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {isAdmin && activeTab === 1 ? 'All Book Requests' : 'My Book Requests'}
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => navigate('/requests')}
            sx={{ backgroundColor: '#e50914', '&:hover': { backgroundColor: '#b20710' } }}
                >
            Requests Panel
          </Button>
          <IconButton color="inherit" onClick={loadRequests} disabled={loading}>
           {loading ? <CircularProgress size={24} color="inherit" /> : <RefreshIcon />}
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 2, pb: 4 }}>
        {/* Admin Tabs */}
        {isAdmin && (
          <Paper sx={{ backgroundColor: '#1a1a1a', mb: 2 }}>
            <Tabs 
              value={activeTab} 
              onChange={handleTabChange}
              textColor="inherit"
              indicatorColor="primary"
              sx={{
                '& .MuiTab-root': { color: '#888' },
                '& .Mui-selected': { color: '#fff' },
              }}
            >
              <Tab label="My Requests" />
              <Tab 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    All Requests
                    {statusCounts.total > 0 && (
                      <Chip 
                        size="small" 
                        label={statusCounts.total} 
                        sx={{ 
                          backgroundColor: '#e50914',
                          color: '#fff',
                          height: 20,
                          fontSize: '0.7rem',
                        }} 
                      />
                    )}
                  </Box>
                } 
              />
            </Tabs>
          </Paper>
        )}

        {/* Status Summary Chips */}
        {requests.length > 0 && (
          <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {statusCounts.pending > 0 && (
              <Chip label={`${statusCounts.pending} Pending`} color="warning" size="small" />
            )}
            {statusCounts.searching > 0 && (
              <Chip label={`${statusCounts.searching} Searching`} color="info" size="small" />
            )}
            {statusCounts.downloading > 0 && (
              <Chip label={`${statusCounts.downloading} Downloading`} color="info" size="small" />
            )}
            {statusCounts.completed > 0 && (
              <Chip label={`${statusCounts.completed} Completed`} color="success" size="small" />
            )}
            {statusCounts.failed > 0 && (
              <Chip label={`${statusCounts.failed} Failed`} color="error" size="small" />
            )}
          </Box>
        )}

        {loading ? (
          <Box sx={{ textAlign: 'center', mt: 8 }}>
            <CircularProgress />
            <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
              Loading requests...
            </Typography>
          </Box>
        ) : requests.length === 0 ? (
          <Box sx={{ textAlign: 'center', mt: 8 }}>
            <Typography variant="h6" color="text.secondary">
              {isAdmin && activeTab === 1 
                ? 'No book requests from any users yet'
                : 'No book requests yet'
              }
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ backgroundColor: '#1a1a1a' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Author</TableCell>
                  {/* Show "Requested By" column only for admin viewing all requests */}
                  {isAdmin && activeTab === 1 && (
                    <TableCell>Requested By</TableCell>
                  )}
                  <TableCell>Status</TableCell>
                  <TableCell>Requested</TableCell>
                  <TableCell>Completed</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {request.title}
                      </Typography>
                      {request.isbn && (
                        <Typography variant="caption" color="text.secondary">
                          ISBN: {request.isbn}
                        </Typography>
                      )}
                      {request.notes && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {request.notes}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{request.author || 'Unknown'}</TableCell>
                    {/* Show requesting user for admin view */}
                    {isAdmin && activeTab === 1 && (
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <PersonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {request.username || request.email || `User #${request.user_id}`}
                          </Typography>
                        </Box>
                      </TableCell>
                    )}
                    <TableCell>
                      <Chip
                        label={request.status.toUpperCase()}
                        color={getStatusColor(request.status)}
                        size="small"
                      />
                      {request.error_message && (
                        <Tooltip title={request.error_message}>
                          <Typography 
                            variant="caption" 
                            color="error" 
                            display="block"
                            sx={{ 
                              maxWidth: 150, 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              cursor: 'help',
                            }}
                          >
                            {request.error_message}
                          </Typography>
                        </Tooltip>
                      )}
                      {request.retry_count > 0 && (
                        <Typography variant="caption" color="warning.main" display="block">
                          Retries: {request.retry_count}/{request.max_retries || 3}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(request.requested_at)}</TableCell>
                    <TableCell>
                      {request.completed_at ? formatDate(request.completed_at) : '-'}
                    </TableCell>
                    <TableCell align="right">
                      {canDelete(request) && (
                        <Tooltip title={isAdmin ? 'Delete request' : 'Cancel request'}>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteClick(request)}
                            sx={{ 
                              color: '#888',
                              '&:hover': { color: '#e50914' },
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{ sx: { backgroundColor: '#1a1a1a' } }}
      >
        <DialogTitle>
          {isAdmin ? 'Delete Request' : 'Cancel Request'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to {isAdmin ? 'delete' : 'cancel'} the request for "{requestToDelete?.title}"?
          </Typography>
          {isAdmin && activeTab === 1 && requestToDelete && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Requested by: {requestToDelete.username || requestToDelete.email || `User #${requestToDelete.user_id}`}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm}
            disabled={deleting}
            sx={{ 
              color: '#e50914',
              '&:hover': { backgroundColor: 'rgba(229, 9, 20, 0.1)' },
            }}
          >
            {deleting ? <CircularProgress size={20} /> : (isAdmin ? 'Delete' : 'Cancel Request')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MyRequests;
