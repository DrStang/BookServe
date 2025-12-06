import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Collapse,
  IconButton,
  Tooltip,
  Paper,
  LinearProgress,
} from '@mui/material';
import {
  TrendingDown as FailureIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { requestsAPI } from '../../services/api';

/**
 * SearchFailuresPanel - Displays search failure statistics for admins
 * 
 * Usage:
 * import { SearchFailuresPanel } from './components/Admin/SearchFailuresPanel';
 * 
 * <SearchFailuresPanel />
 */
const SearchFailuresPanel = ({ defaultExpanded = false }) => {
  const [failures, setFailures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [error, setError] = useState(null);
  const [lastLoaded, setLastLoaded] = useState(null);

  const loadFailures = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await requestsAPI.getSearchFailures();
      setFailures(response.data.stats || []);
      setLastLoaded(new Date());
    } catch (err) {
      console.error('Error loading search failures:', err);
      setError(err.response?.data?.error || 'Failed to load search failure statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded && !lastLoaded) {
      loadFailures();
    }
  }, [expanded, lastLoaded, loadFailures]);

  const totalFailures = failures.reduce((sum, f) => sum + f.count, 0);

  // Calculate failure breakdown for visualization
  const getFailureBreakdown = () => {
    if (totalFailures === 0) return [];
    
    return failures.map(f => ({
      ...f,
      percentage: Math.round((f.count / totalFailures) * 100)
    }));
  };

  const getReasonLabel = (reason) => {
    const labels = {
      'no_results': 'No Results Found',
      'api_error': 'API Error',
      'timeout': 'Search Timeout',
      'invalid_response': 'Invalid Response',
    };
    return labels[reason] || reason || 'Unknown';
  };

  const getReasonColor = (reason) => {
    const colors = {
      'no_results': 'warning',
      'api_error': 'error',
      'timeout': 'info',
      'invalid_response': 'error',
    };
    return colors[reason] || 'default';
  };

  return (
    <Card 
      sx={{ 
        mb: 3,
        border: totalFailures > 10 ? '1px solid' : 'none',
        borderColor: 'warning.main'
      }}
    >
      <CardHeader
        avatar={
          <FailureIcon 
            color={totalFailures > 0 ? 'error' : 'success'} 
          />
        }
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">Search Failure Analysis</Typography>
            {totalFailures > 0 && (
              <Chip 
                label={`${totalFailures} failures`} 
                size="small" 
                color="error" 
                variant="outlined"
              />
            )}
          </Box>
        }
        subheader="Last 30 days - helps identify patterns in failed book searches"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton 
                size="small" 
                onClick={loadFailures} 
                disabled={loading}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <IconButton 
              onClick={() => setExpanded(!expanded)}
              sx={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s'
              }}
            >
              <ExpandMoreIcon />
            </IconButton>
          </Box>
        }
        sx={{ cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      />

      {loading && <LinearProgress />}

      <Collapse in={expanded}>
        <CardContent>
          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : failures.length === 0 && !loading ? (
            <Alert 
              severity="success" 
              icon={<SuccessIcon />}
              sx={{ mb: 2 }}
            >
              <Typography variant="subtitle2">
                No search failures in the last 30 days! 🎉
              </Typography>
              <Typography variant="body2">
                Your search configuration is working well.
              </Typography>
            </Alert>
          ) : (
            <>
              {/* Summary Info */}
              <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <strong>Tips to reduce failures:</strong>
                </Typography>
                <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                  <li>Use the "Retry" button on failed requests to try alternate search terms</li>
                  <li>Check if books are available on your indexers</li>
                  <li>Simplify titles by removing subtitles and series info</li>
                  <li>Try searching by ISBN when available</li>
                </ul>
              </Alert>

              {/* Failure Breakdown */}
              {getFailureBreakdown().length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Failure Breakdown
                  </Typography>
                  {getFailureBreakdown().map((failure, index) => (
                    <Box key={index} sx={{ mb: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">
                          {getReasonLabel(failure.failure_reason)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {failure.count} ({failure.percentage}%)
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={failure.percentage} 
                        color={getReasonColor(failure.failure_reason)}
                        sx={{ height: 8, borderRadius: 1 }}
                      />
                    </Box>
                  ))}
                </Box>
              )}

              {/* Detailed Table */}
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Failure Reason</TableCell>
                      <TableCell align="center">Count</TableCell>
                      <TableCell>Sample Titles (click to copy)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {failures.map((failure, index) => {
                      const sampleTitles = failure.sample_titles?.split(' | ').slice(0, 5) || [];
                      
                      return (
                        <TableRow key={index} hover>
                          <TableCell>
                            <Chip 
                              label={getReasonLabel(failure.failure_reason)} 
                              size="small"
                              color={getReasonColor(failure.failure_reason)}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="h6" component="span">
                              {failure.count}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {sampleTitles.map((title, i) => (
                                <Tooltip 
                                  key={i} 
                                  title="Click to copy"
                                  placement="top"
                                >
                                  <Chip
                                    label={title.length > 40 ? title.slice(0, 40) + '...' : title}
                                    size="small"
                                    variant="outlined"
                                    onClick={() => {
                                      navigator.clipboard.writeText(title);
                                    }}
                                    sx={{ 
                                      cursor: 'pointer',
                                      '&:hover': { bgcolor: 'action.hover' }
                                    }}
                                  />
                                </Tooltip>
                              ))}
                              {sampleTitles.length === 0 && (
                                <Typography variant="body2" color="text.secondary">
                                  No samples available
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Last Updated */}
              {lastLoaded && (
                <Typography 
                  variant="caption" 
                  color="text.secondary" 
                  sx={{ display: 'block', mt: 2, textAlign: 'right' }}
                >
                  Last updated: {lastLoaded.toLocaleTimeString()}
                </Typography>
              )}
            </>
          )}
        </CardContent>
      </Collapse>
    </Card>
  );
};

export default SearchFailuresPanel;
