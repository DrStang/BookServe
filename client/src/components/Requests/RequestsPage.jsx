import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  AppBar,
  Toolbar,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Person as PersonIcon,
  Replay as RetryIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TrendingDown as FailureIcon,
  Info as InfoIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { requestsAPI } from '../../services/api';
import { isAdmin as checkIsAdmin } from '../../utils/auth';

// Status styling
const statusColors = {
  pending: 'default',
  searching: 'info',
  downloading: 'primary',
  completed: 'success',
  failed: 'error',
};

const statusIcons = {
  pending: <PendingIcon fontSize="small" />,
  searching: <SearchIcon fontSize="small" />,
  downloading: <DownloadIcon fontSize="small" />,
  completed: <CheckCircleIcon fontSize="small" />,
  failed: <ErrorIcon fontSize="small" />,
};

// ============================================================================
// RETRY DIALOG COMPONENT
// ============================================================================
const RetryDialog = ({ open, onClose, request, onRetrySuccess }) => {
  const [customTitle, setCustomTitle] = useState('');
  const [customAuthor, setCustomAuthor] = useState('');
  const [customIsbn, setCustomIsbn] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Reset form when dialog opens with new request
  useEffect(() => {
    if (open && request) {
      setCustomTitle(request.title || '');
      setCustomAuthor(request.author || '');
      setCustomIsbn(request.isbn || '');
      setResult(null);
      setError(null);
    }
  }, [open, request]);

  const handleRetry = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await requestsAPI.retryWithCustomSearch(request.id, {
        customTitle: customTitle !== request.title ? customTitle : undefined,
        customAuthor: customAuthor !== request.author ? customAuthor : undefined,
        customIsbn: customIsbn !== request.isbn ? customIsbn : undefined,
      });

      setResult(response.data);

      if (response.data.success) {
        // Notify parent to refresh the list
        setTimeout(() => {
          onRetrySuccess?.();
          onClose();
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to retry search');
    } finally {
      setLoading(false);
    }
  };

  if (!request) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RetryIcon color="primary" />
          Retry Search with Custom Terms
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          The original search failed. You can try again with modified search terms.
          Sometimes simplifying the title or fixing author name spelling helps.
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Title"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g., remove subtitle or series info"
              helperText={
                customTitle !== request.title 
                  ? `Original: "${request.title}"` 
                  : 'Tip: Try removing subtitles, series info, or "A Novel"'
              }
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Author"
              value={customAuthor}
              onChange={(e) => setCustomAuthor(e.target.value)}
              placeholder="e.g., try last name only"
              helperText={
                customAuthor !== request.author 
                  ? `Original: "${request.author}"` 
                  : 'Tip: Try just the last name, or check spelling'
              }
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="ISBN (optional)"
              value={customIsbn}
              onChange={(e) => setCustomIsbn(e.target.value)}
              placeholder="ISBN-10 or ISBN-13"
              helperText="ISBN search is most reliable if you have it"
            />
          </Grid>
        </Grid>

        {/* Result Display */}
        {result && (
          <Alert 
            severity={result.success ? 'success' : 'warning'} 
            sx={{ mt: 3 }}
          >
            <Typography variant="subtitle2">{result.message}</Typography>
            {result.searchResult && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2">
                  <strong>Found:</strong> {result.searchResult.title}
                </Typography>
                <Typography variant="body2">
                  <strong>Match Score:</strong> {result.searchResult.score}%
                </Typography>
                {result.searchResult.format && (
                  <Typography variant="body2">
                    <strong>Format:</strong> {result.searchResult.format.toUpperCase()}
                  </Typography>
                )}
              </Box>
            )}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 3 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleRetry}
          disabled={loading || !customTitle.trim()}
          startIcon={loading ? <CircularProgress size={20} /> : <RetryIcon />}
        >
          {loading ? 'Searching...' : 'Retry Search'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// SEARCH FAILURES PANEL (Admin only)
// ============================================================================
const SearchFailuresPanel = () => {
  const [failures, setFailures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(null);

  const loadFailures = useCallback(async () => {
    try {
      setLoading(true);
      const response = await requestsAPI.getSearchFailures();
      setFailures(response.data.stats || []);
    } catch (err) {
      console.error('Error loading search failures:', err);
      setError('Failed to load search failure statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded) {
      loadFailures();
    }
  }, [expanded, loadFailures]);

  const totalFailures = failures.reduce((sum, f) => sum + f.count, 0);

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ pb: 1 }}>
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}
          onClick={() => setExpanded(!expanded)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FailureIcon color="error" />
            <Typography variant="h6">
              Search Failure Analysis
            </Typography>
            {totalFailures > 0 && (
              <Chip 
                label={`${totalFailures} failures (30 days)`} 
                size="small" 
                color="error" 
                variant="outlined"
              />
            )}
          </Box>
          <IconButton size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </CardContent>

      <Collapse in={expanded}>
        <Divider />
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : failures.length === 0 ? (
            <Alert severity="success">
              No search failures in the last 30 days! 🎉
            </Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Understanding why searches fail can help improve success rates.
                Common issues include misspelled titles, unusual author name formats,
                or books not available on indexers.
              </Typography>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Failure Reason</TableCell>
                      <TableCell align="right">Count</TableCell>
                      <TableCell>Sample Titles</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {failures.map((failure, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Chip 
                            label={failure.failure_reason || 'unknown'} 
                            size="small"
                            color={failure.failure_reason === 'no_results' ? 'warning' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <strong>{failure.count}</strong>
                        </TableCell>
                        <TableCell>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              maxWidth: 400, 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {failure.sample_titles?.split(' | ').slice(0, 3).join(', ')}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button 
                  size="small" 
                  startIcon={<RefreshIcon />}
                  onClick={loadFailures}
                >
                  Refresh
                </Button>
              </Box>
            </>
          )}
        </CardContent>
      </Collapse>
    </Card>
  );
};

// ============================================================================
// MAIN REQUESTS PAGE COMPONENT
// ============================================================================
const RequestsPage = () => {
  const isAdmin = checkIsAdmin();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0); // 0 = My Requests, 1 = All Requests (admin)
  const [statusFilter, setStatusFilter] = useState(null);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Retry dialog state
  const [retryDialogOpen, setRetryDialogOpen] = useState(false);
  const [requestToRetry, setRequestToRetry] = useState(null);

  // Stats
  const [stats, setStats] = useState(null);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let response;
      if (isAdmin && activeTab === 1) {
        response = await requestsAPI.getAllRequests(statusFilter);
      } else {
        response = await requestsAPI.getMyRequests();
      }

      setRequests(response.data.requests || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, activeTab, statusFilter]);

  const fetchStats = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await requestsAPI.getStats();
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchRequests();
    fetchStats();
  }, [fetchRequests, fetchStats]);

  const handleDeleteClick = (request) => {
    setRequestToDelete(request);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!requestToDelete) return;

    try {
      setDeleting(true);
      await requestsAPI.delete(requestToDelete.id);
      setRequests(requests.filter(r => r.id !== requestToDelete.id));
      setDeleteDialogOpen(false);
      setRequestToDelete(null);
      fetchStats();
    } catch (err) {
      console.error('Error deleting request:', err);
      setError('Failed to delete request');
    } finally {
      setDeleting(false);
    }
  };

  const handleRetryClick = (request) => {
    setRequestToRetry(request);
    setRetryDialogOpen(true);
  };

  const handleRetrySuccess = () => {
    fetchRequests();
    fetchStats();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <AppBar position="static" sx={{ backgroundColor: '#1a1a1a' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/my-requests')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h4" gutterBottom>
            Book Requests
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Admin Stats Cards */}
      {isAdmin && stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={4} md={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4">{stats.total || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Total</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" color="text.secondary">{stats.pending || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Pending</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" color="info.main">{stats.searching || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Searching</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" color="primary.main">{stats.downloading || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Downloading</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" color="success.main">{stats.completed || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Completed</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" color="error.main">{stats.failed || 0}</Typography>
                <Typography variant="body2" color="text.secondary">Failed</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Search Failures Panel (Admin Only) */}
      {isAdmin && <SearchFailuresPanel />}

      {/* Tabs for Admin */}
      {isAdmin && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="My Requests" />
            <Tab label="All Requests" icon={<PersonIcon fontSize="small" />} iconPosition="end" />
          </Tabs>
        </Box>
      )}

      {/* Status Filter (for All Requests tab) */}
      {isAdmin && activeTab === 1 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label="All"
            onClick={() => setStatusFilter(null)}
            color={statusFilter === null ? 'primary' : 'default'}
            variant={statusFilter === null ? 'filled' : 'outlined'}
          />
          {['pending', 'searching', 'downloading', 'completed', 'failed'].map((status) => (
            <Chip
              key={status}
              label={status.charAt(0).toUpperCase() + status.slice(1)}
              onClick={() => setStatusFilter(status)}
              color={statusFilter === status ? statusColors[status] : 'default'}
              variant={statusFilter === status ? 'filled' : 'outlined'}
              icon={statusIcons[status]}
            />
          ))}
        </Box>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Requests Table */}
      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : requests.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No requests found
            </Typography>
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Author</TableCell>
                <TableCell>Status</TableCell>
                {isAdmin && activeTab === 1 && <TableCell>Requested By</TableCell>}
                <TableCell>Requested</TableCell>
                <TableCell>Error</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {request.title}
                    </Typography>
                    {request.isbn && (
                      <Typography variant="caption" color="text.secondary">
                        ISBN: {request.isbn}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{request.author || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={request.status}
                      color={statusColors[request.status] || 'default'}
                      size="small"
                      icon={statusIcons[request.status]}
                    />
                    {request.retry_count > 0 && (
                      <Tooltip title={`Retry ${request.retry_count}/${request.max_retries}`}>
                        <Chip
                          label={`R${request.retry_count}`}
                          size="small"
                          variant="outlined"
                          sx={{ ml: 0.5 }}
                        />
                      </Tooltip>
                    )}
                  </TableCell>
                  {isAdmin && activeTab === 1 && (
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PersonIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          {request.username || `User ${request.user_id}`}
                        </Typography>
                      </Box>
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(request.requested_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {request.error_message && (
                      <Tooltip title={request.error_message}>
                        <Typography 
                          variant="body2" 
                          color="error"
                          sx={{ 
                            maxWidth: 200, 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {request.error_message}
                        </Typography>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      {/* Retry button - show for failed requests */}
                      {request.status === 'failed' && (
                        <Tooltip title="Retry with custom search terms">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleRetryClick(request)}
                          >
                            <RetryIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      
                      {/* Delete button */}
                      {(request.status === 'pending' || request.status === 'failed' || isAdmin) && (
                        <Tooltip title="Delete request">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(request)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* Refresh Button */}
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          startIcon={<RefreshIcon />}
          onClick={fetchRequests}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Request</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the request for "{requestToDelete?.title}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Retry Dialog */}
      <RetryDialog
        open={retryDialogOpen}
        onClose={() => {
          setRetryDialogOpen(false);
          setRequestToRetry(null);
        }}
        request={requestToRetry}
        onRetrySuccess={handleRetrySuccess}
      />
    </Box>
  );
};

export default RequestsPage;
