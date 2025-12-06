import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Container,
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  Paper,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  LibraryBooks as BooksIcon,
  CloudDownload as RequestsIcon,
  TrendingUp as NYTIcon,
  Folder as ScanIcon,
  Psychology as AIIcon,
  Edit as BulkEditIcon,
  People as UsersIcon,
  Refresh as RefreshIcon,
  CheckCircle as EnabledIcon,
  Cancel as DisabledIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { adminAPI, nytAPI } from '../../services/api';
import { isAdmin } from '../../utils/auth';
import NYTAdminPanel from './NYTAdminPanel';
import BulkEditModal from './BulkEditModal';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [nytStatus, setNytStatus] = useState(null);
  const [scanStatus, setScanStatus] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState([]);

  // Redirect non-admins
  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    if (isAdmin()) {
      loadDashboardData();
    }
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load all status data in parallel
      const [requestStatsRes, nytStatusRes, scanStatusRes, aiStatusRes] = await Promise.allSettled([
        adminAPI.getRequestStats(),
        nytAPI.getStatus(),
        adminAPI.getScanStatus(),
        adminAPI.getAICacheStatus(),
      ]);

      if (requestStatsRes.status === 'fulfilled') {
        setStats(requestStatsRes.value.data);
      }
      if (nytStatusRes.status === 'fulfilled') {
        setNytStatus(nytStatusRes.value.data);
      }
      if (scanStatusRes.status === 'fulfilled') {
        setScanStatus(scanStatusRes.value.data);
      }
      if (aiStatusRes.status === 'fulfilled') {
        setAiStatus(aiStatusRes.value.data);
      }
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (actionName, actionFn) => {
    setActionLoading(prev => ({ ...prev, [actionName]: true }));
    try {
      await actionFn();
      // Reload data after action
      await loadDashboardData();
    } catch (err) {
      setError(`Failed to ${actionName}`);
      console.error(err);
    } finally {
      setActionLoading(prev => ({ ...prev, [actionName]: false }));
    }
  };

  const StatusChip = ({ enabled, enabledText = 'Enabled', disabledText = 'Disabled' }) => (
    <Chip
      icon={enabled ? <EnabledIcon /> : <DisabledIcon />}
      label={enabled ? enabledText : disabledText}
      color={enabled ? 'success' : 'default'}
      size="small"
    />
  );

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#0f0f0f' }}>
      <AppBar position="static" sx={{ backgroundColor: '#1a1a1a' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Admin Dashboard
          </Typography>
          <IconButton color="inherit" onClick={loadDashboardData}>
            <RefreshIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, pb: 4 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Quick Stats */}
          <Grid item xs={12}>
            <Typography variant="h5" gutterBottom sx={{ color: '#fff', mb: 2 }}>
              Quick Stats
            </Typography>
          </Grid>

          <Grid item xs={6} sm={3}>
            <Card sx={{ backgroundColor: '#1a1a1a', textAlign: 'center' }}>
              <CardContent>
                <Typography variant="h3" color="primary">
                  {stats.total || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Requests
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={6} sm={3}>
            <Card sx={{ backgroundColor: '#1a1a1a', textAlign: 'center' }}>
              <CardContent>
                <Typography variant="h3" sx={{ color: '#ff9800' }}>
                  {stats.pending || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Pending
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={6} sm={3}>
            <Card sx={{ backgroundColor: '#1a1a1a', textAlign: 'center' }}>
              <CardContent>
                <Typography variant="h3" sx={{ color: '#4caf50' }}>
                  {stats.completed || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Completed
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={6} sm={3}>
            <Card sx={{ backgroundColor: '#1a1a1a', textAlign: 'center' }}>
              <CardContent>
                <Typography variant="h3" sx={{ color: '#f44336' }}>
                  {stats.failed || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Failed
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Quick Actions */}
          <Grid item xs={12}>
            <Typography variant="h5" gutterBottom sx={{ color: '#fff', mt: 2, mb: 2 }}>
              Quick Actions
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ backgroundColor: '#1a1a1a' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <RequestsIcon color="primary" />
                  <Typography variant="h6">Book Requests</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  View and manage all book requests from all users.
                </Typography>
              </CardContent>
              <CardActions>
                <Button 
                  variant="contained" 
                  onClick={() => navigate('/my-requests')}
                  sx={{ backgroundColor: '#e50914', '&:hover': { backgroundColor: '#b20710' } }}
                >
                  View All Requests
                </Button>
              </CardActions>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ backgroundColor: '#1a1a1a' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <BulkEditIcon color="primary" />
                  <Typography variant="h6">Bulk Edit Books</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Edit multiple books at once - perfect for adding series info.
                </Typography>
              </CardContent>
              <CardActions>
                <Button 
                  variant="contained"
                  onClick={() => setBulkEditOpen(true)}
                  sx={{ backgroundColor: '#e50914', '&:hover': { backgroundColor: '#b20710' } }}
                >
                  Open Bulk Editor
                </Button>
              </CardActions>
            </Card>
          </Grid>

          {/* Services Status */}
          <Grid item xs={12}>
            <Typography variant="h5" gutterBottom sx={{ color: '#fff', mt: 2, mb: 2 }}>
              Services
            </Typography>
          </Grid>

          {/* NYT Bestsellers Service */}
          <Grid item xs={12} md={6}>
            <Card sx={{ backgroundColor: '#1a1a1a' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <NYTIcon color="primary" />
                    <Typography variant="h6">NYT Bestsellers</Typography>
                  </Box>
                  <StatusChip enabled={nytStatus?.enabled} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Automatically downloads NYT bestsellers weekly.
                </Typography>
                {nytStatus && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      API Key: {nytStatus.apiKeyConfigured ? '✓ Configured' : '✗ Not configured'}
                    </Typography>
                    <br />
                    <Typography variant="caption" color="text.secondary">
                      Check Interval: Every {nytStatus.checkIntervalDays} days
                    </Typography>
                  </Box>
                )}
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  disabled={!nytStatus?.enabled || actionLoading.nyt}
                  onClick={() => handleAction('nyt', () => nytAPI.triggerCheck())}
                  startIcon={actionLoading.nyt ? <CircularProgress size={16} /> : null}
                >
                  Trigger Check Now
                </Button>
                <Button 
                  variant="contained" 
                  onClick={() => navigate('/NYTPanel')}
                  sx={{ backgroundColor: '#e50914', '&:hover': { backgroundColor: '#b20710' } }}
                >
                  NYT Panel
                </Button>
              </CardActions>
            </Card>
          </Grid>

          {/* Folder Scanner Service */}
          <Grid item xs={12} md={6}>
            <Card sx={{ backgroundColor: '#1a1a1a' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ScanIcon color="primary" />
                    <Typography variant="h6">Folder Scanner</Typography>
                  </Box>
                  <StatusChip enabled={scanStatus?.enabled} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Automatically imports books from watched folders.
                </Typography>
                {scanStatus && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Last Scan: {scanStatus.lastScan ? new Date(scanStatus.lastScan).toLocaleString() : 'Never'}
                    </Typography>
                    <br />
                    <Typography variant="caption" color="text.secondary">
                      Books Found: {scanStatus.booksFound || 0}
                    </Typography>
                  </Box>
                )}
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  disabled={!scanStatus?.enabled || actionLoading.scan}
                  onClick={() => handleAction('scan', () => adminAPI.triggerScan())}
                  startIcon={actionLoading.scan ? <CircularProgress size={16} /> : null}
                >
                  Trigger Scan Now
                </Button>
              </CardActions>
            </Card>
          </Grid>

          {/* AI Cache Service */}
          <Grid item xs={12} md={6}>
            <Card sx={{ backgroundColor: '#1a1a1a' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AIIcon color="primary" />
                    <Typography variant="h6">AI Recommendations</Typography>
                  </Box>
                  <StatusChip enabled={aiStatus?.enabled} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Background AI recommendation caching service.
                </Typography>
                {aiStatus && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Cached Users: {aiStatus.cachedUsers || 0}
                    </Typography>
                    <br />
                    <Typography variant="caption" color="text.secondary">
                      Queue Size: {aiStatus.queueSize || 0}
                    </Typography>
                  </Box>
                )}
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  disabled={!aiStatus?.enabled || actionLoading.ai}
                  onClick={() => handleAction('ai', () => adminAPI.triggerAIUpdate())}
                  startIcon={actionLoading.ai ? <CircularProgress size={16} /> : null}
                >
                  Trigger Update
                </Button>
                <Button
                  size="small"
                  disabled={actionLoading.aiInvalidate}
                  onClick={() => handleAction('aiInvalidate', () => adminAPI.invalidateAICache())}
                  startIcon={actionLoading.aiInvalidate ? <CircularProgress size={16} /> : null}
                >
                  Clear Cache
                </Button>
              </CardActions>
            </Card>
          </Grid>

          {/* System Info */}
          <Grid item xs={12} md={6}>
            <Card sx={{ backgroundColor: '#1a1a1a' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <StorageIcon color="primary" />
                  <Typography variant="h6">System</Typography>
                </Box>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Library Model" 
                      secondary="Shared (Plex-style) - All users access same books"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Reading Progress" 
                      secondary="Per-user - Each user has their own progress"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Book Requests" 
                      secondary="Per-user (Admin sees all)"
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Navigation Links */}
          <Grid item xs={12}>
            <Typography variant="h5" gutterBottom sx={{ color: '#fff', mt: 2, mb: 2 }}>
              Admin Pages
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ backgroundColor: '#1a1a1a' }}>
              <List>
                <ListItem button onClick={() => navigate('/requests')}>
                  <ListItemIcon>
                    <RequestsIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="All Book Requests" 
                    secondary="View and manage requests from all users"
                  />
                </ListItem>
                <Divider />
                <ListItem button onClick={() => navigate('/library')}>
                  <ListItemIcon>
                    <BooksIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Library Management" 
                    secondary="Edit books, manage series, bulk operations"
                  />
                </ListItem>
                <Divider />
                <ListItem button onClick={() => navigate('/goodreads')}>
                  <ListItemIcon>
                    <UsersIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Goodreads Import" 
                    secondary="Import reading lists from Goodreads CSV"
                  />
                </ListItem>
              </List>
            </Paper>
          </Grid>
        </Grid>
      </Container>

      {/* Bulk Edit Modal */}
      <BulkEditModal
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        selectedBooks={selectedBooks}
        onComplete={() => {
          setBulkEditOpen(false);
          setSelectedBooks([]);
        }}
      />
    </Box>
  );
};

export default AdminDashboard;
