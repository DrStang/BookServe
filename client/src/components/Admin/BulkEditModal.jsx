import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  Autocomplete,
  CircularProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  CollectionsBookmark as SeriesIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { booksAPI } from '../../services/api';

const BulkEditModal = ({ open, onClose, selectedBooks = [], onComplete }) => {
  const [updates, setUpdates] = useState({
    series: '',
    series_number_start: '',
    categories: '',
    language: '',
    publisher: '',
  });
  const [seriesOptions, setSeriesOptions] = useState([]);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [autoNumberSeries, setAutoNumberSeries] = useState(false);

  // Fetch series list for autocomplete
  useEffect(() => {
    if (open && seriesOptions.length === 0) {
      fetchSeriesList();
    }
  }, [open]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setUpdates({
        series: '',
        series_number_start: '',
        categories: '',
        language: '',
        publisher: '',
      });
      setError(null);
      setResult(null);
      setAutoNumberSeries(false);
    }
  }, [open]);

  const fetchSeriesList = async () => {
    setLoadingSeries(true);
    try {
      const response = await booksAPI.getAllSeries();
      if (response.data.series) {
        setSeriesOptions(response.data.series.map(s => s.series));
      }
    } catch (error) {
      console.error('Failed to fetch series list:', error);
    } finally {
      setLoadingSeries(false);
    }
  };

  const handleSave = async () => {
    // Build updates object with only non-empty values
    const bulkUpdates = {};
    
    if (updates.series && updates.series.trim()) {
      bulkUpdates.series = updates.series.trim();
    }
    if (updates.categories && updates.categories.trim()) {
      bulkUpdates.categories = updates.categories.trim();
    }
    if (updates.language && updates.language.trim()) {
      bulkUpdates.language = updates.language.trim();
    }
    if (updates.publisher && updates.publisher.trim()) {
      bulkUpdates.publisher = updates.publisher.trim();
    }

    if (Object.keys(bulkUpdates).length === 0 && !autoNumberSeries) {
      setError('Please fill in at least one field to update');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const bookIds = selectedBooks.map(book => book.id);

      if (autoNumberSeries && updates.series) {
        // Update each book with incremented series number
        const startNum = parseInt(updates.series_number_start) || 1;
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < selectedBooks.length; i++) {
          try {
            await booksAPI.update(selectedBooks[i].id, {
              ...bulkUpdates,
              series_number: startNum + i,
            });
            successCount++;
          } catch (err) {
            failCount++;
          }
        }

        setResult({
          success: Array(successCount).fill(0),
          failed: Array(failCount).fill({ error: 'Failed' }),
        });
      } else {
        // Regular bulk update
        const response = await booksAPI.bulkUpdate(bookIds, bulkUpdates);
        setResult(response.data.results);
      }

      // Notify parent to refresh
      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update books');
    } finally {
      setSaving(false);
    }
  };

  const getBookCoverUrl = (book) => {
    return book.cover_image || booksAPI.getCoverUrl(book.id);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EditIcon />
        Bulk Edit {selectedBooks.length} Book{selectedBooks.length !== 1 ? 's' : ''}
      </DialogTitle>

      <DialogContent dividers>
        {/* Selected Books List */}
        <Typography variant="subtitle2" gutterBottom>
          Selected Books:
        </Typography>
        <Box sx={{ maxHeight: 150, overflow: 'auto', mb: 3, bgcolor: 'grey.50', borderRadius: 1 }}>
          <List dense>
            {selectedBooks.map((book, index) => (
              <ListItem key={book.id}>
                <ListItemAvatar>
                  <Avatar 
                    src={getBookCoverUrl(book)} 
                    variant="rounded"
                    sx={{ width: 32, height: 48 }}
                  >
                    {book.title?.[0]}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={book.title}
                  secondary={
                    <>
                      {book.author}
                      {book.series && (
                        <Chip 
                          size="small" 
                          label={`${book.series}${book.series_number ? ` #${book.series_number}` : ''}`}
                          sx={{ ml: 1 }}
                        />
                      )}
                    </>
                  }
                />
                {autoNumberSeries && (
                  <Typography variant="caption" color="primary">
                    #{(parseInt(updates.series_number_start) || 1) + index}
                  </Typography>
                )}
              </ListItem>
            ))}
          </List>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Edit Fields */}
        <Typography variant="subtitle2" gutterBottom>
          Update Fields (leave empty to skip):
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          {/* Series with Autocomplete */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <Autocomplete
              freeSolo
              options={seriesOptions}
              loading={loadingSeries}
              value={updates.series}
              onInputChange={(event, newValue) => {
                setUpdates({ ...updates, series: newValue });
              }}
              sx={{ flex: 2 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Series Name"
                  placeholder="Enter or select series"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: <SeriesIcon sx={{ mr: 1, color: 'action.active' }} />,
                    endAdornment: (
                      <>
                        {loadingSeries ? <CircularProgress size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
            
            {updates.series && (
              <>
                <FormControl sx={{ minWidth: 180 }}>
                  <InputLabel>Auto-number?</InputLabel>
                  <Select
                    value={autoNumberSeries ? 'yes' : 'no'}
                    label="Auto-number?"
                    onChange={(e) => setAutoNumberSeries(e.target.value === 'yes')}
                  >
                    <MenuItem value="no">No</MenuItem>
                    <MenuItem value="yes">Yes</MenuItem>
                  </Select>
                </FormControl>

                {autoNumberSeries && (
                  <TextField
                    label="Start #"
                    type="number"
                    value={updates.series_number_start}
                    onChange={(e) => setUpdates({ ...updates, series_number_start: e.target.value })}
                    sx={{ width: 100 }}
                    InputProps={{ inputProps: { min: 1 } }}
                    placeholder="1"
                  />
                )}
              </>
            )}
          </Box>

          {autoNumberSeries && updates.series && (
            <Alert severity="info" sx={{ mt: -1 }}>
              Books will be numbered {parseInt(updates.series_number_start) || 1} through{' '}
              {(parseInt(updates.series_number_start) || 1) + selectedBooks.length - 1} in the order shown above.
            </Alert>
          )}

          {/* Categories */}
          <TextField
            fullWidth
            label="Categories"
            value={updates.categories}
            onChange={(e) => setUpdates({ ...updates, categories: e.target.value })}
            helperText="Comma-separated list of categories"
          />

          {/* Language */}
          <TextField
            fullWidth
            label="Language"
            value={updates.language}
            onChange={(e) => setUpdates({ ...updates, language: e.target.value })}
            placeholder="e.g., en, es, fr"
          />

          {/* Publisher */}
          <TextField
            fullWidth
            label="Publisher"
            value={updates.publisher}
            onChange={(e) => setUpdates({ ...updates, publisher: e.target.value })}
          />
        </Box>

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {/* Result */}
        {result && (
          <Alert 
            severity={result.failed?.length > 0 ? 'warning' : 'success'} 
            sx={{ mt: 2 }}
          >
            Updated {result.success?.length || 0} book{(result.success?.length || 0) !== 1 ? 's' : ''} successfully.
            {result.failed?.length > 0 && (
              <> {result.failed.length} failed.</>
            )}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} startIcon={<CancelIcon />}>
          {result ? 'Close' : 'Cancel'}
        </Button>
        {!result && (
          <Button
            variant="contained"
            onClick={handleSave}
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            disabled={saving}
          >
            Update {selectedBooks.length} Book{selectedBooks.length !== 1 ? 's' : ''}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BulkEditModal;
