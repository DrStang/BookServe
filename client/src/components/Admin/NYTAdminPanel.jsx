import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  ToolBar,
  IconButton,
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Collapse,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Refresh as RefreshIcon,
  PlayArrow as TriggerIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as EnabledIcon,
  Cancel as DisabledIcon,
} from '@mui/icons-material';
import { nytAPI } from '../../services/api';

const NYTAdminPanel = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showLists, setShowLists] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await nytAPI.getStatus();
      setStatus(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch NYT service status');
    } finally {
      setLoading(false);
    }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await nytAPI.triggerCheck();
      setSuccess('Bestsellers check triggered successfully. Check requests page for new books.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to trigger bestsellers check');
    } finally {
      setTriggering(false);
    }
  };

  const fetchLists = async () => {
    if (lists.length > 0) {
      setShowLists(!showLists);
      return;
    }

    setLoadingLists(true);
    try {
      const response = await nytAPI.getLists();
      setLists(response.data.lists || []);
      setShowLists(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch NYT lists');
    } finally {
      setLoadingLists(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <AppBar position="static" sx={{ backgroundColor: '#1a1a1a' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/admin')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            NYT Admin Panel
          </Typography>
        </Toolbar>
      </AppBar>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            NYT Bestsellers Service
          </Typography>
          <Chip
            icon={status?.enabled ? <EnabledIcon /> : <DisabledIcon />}
            label={status?.enabled ? 'Enabled' : 'Disabled'}
            color={status?.enabled ? 'success' : 'default'}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {status && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>API Key:</strong> {status.apiKeyConfigured ? 'Configured ✓' : 'Not configured ✗'}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>Check Interval:</strong> Every {status.checkIntervalDays} days
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>Admin User ID:</strong> {status.adminUserId}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>Categories:</strong>
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', ml: 2 }}>
              {status.categories?.map((cat, i) => (
                <Chip key={i} label={cat} size="small" variant="outlined" />
              ))}
            </Box>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={triggering ? <CircularProgress size={20} /> : <TriggerIcon />}
            onClick={handleTrigger}
            disabled={triggering || !status?.enabled || !status?.apiKeyConfigured}
          >
            Trigger Check Now
          </Button>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchStatus}
          >
            Refresh Status
          </Button>

          <Button
            variant="outlined"
            endIcon={showLists ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={fetchLists}
            disabled={loadingLists || !status?.apiKeyConfigured}
          >
            {loadingLists ? 'Loading...' : 'View Available Lists'}
          </Button>
        </Box>

        <Collapse in={showLists}>
          <Box sx={{ mt: 2, maxHeight: 300, overflow: 'auto' }}>
            <Typography variant="subtitle2" gutterBottom>
              Available NYT Bestseller Lists ({lists.length})
            </Typography>
            <List dense>
              {lists.map((list, index) => (
                <ListItem key={index} sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={list.displayName}
                    secondary={
                      <>
                        <code style={{ fontSize: '0.75rem' }}>{list.name}</code>
                        {list.updated && (
                          <span style={{ marginLeft: 8, color: '#666' }}>
                            Updated: {list.updated}
                          </span>
                        )}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </Collapse>

        {!status?.enabled && (
          <Alert severity="info" sx={{ mt: 2 }}>
            To enable the NYT Bestsellers service, set <code>NYT_ENABLED=true</code> and <code>NYT_API_KEY=your_key</code> in your environment.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default NYTAdminPanel;
