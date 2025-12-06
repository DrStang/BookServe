import React, { useState, useEffect, useCallback } from 'react';
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
  Checkbox,
  InputAdornment,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  CollectionsBookmark as SeriesIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  ArrowForward as NextIcon,
  ArrowBack as BackIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxBlankIcon,
  SelectAll as SelectAllIcon,
  Deselect as DeselectIcon,
} from '@mui/icons-material';
import { booksAPI } from '../../services/api';

const STEPS = ['Select Books', 'Edit Fields'];

const BulkEditModal = ({ open, onClose, onComplete }) => {
  // Step management
  const [activeStep, setActiveStep] = useState(0);

  // Search and selection state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Edit fields state
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

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedBooks([]);
      setHasSearched(false);
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

  // Fetch series list for autocomplete when reaching step 2
  useEffect(() => {
    if (open && activeStep === 1 && seriesOptions.length === 0) {
      fetchSeriesList();
    }
  }, [open, activeStep]);

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

  // Debounced search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setSearching(true);
    setHasSearched(true);
    try {
      const response = await booksAPI.search(searchQuery);
      setSearchResults(response.data.books || []);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  // Search on Enter key
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleToggleBook = (book) => {
    setSelectedBooks(prev => {
      const isSelected = prev.some(b => b.id === book.id);
      if (isSelected) {
        return prev.filter(b => b.id !== book.id);
      } else {
        return [...prev, book];
      }
    });
  };

  const handleSelectAll = () => {
    const newSelections = searchResults.filter(
      book => !selectedBooks.some(b => b.id === book.id)
    );
    setSelectedBooks(prev => [...prev, ...newSelections]);
  };

  const handleDeselectAll = () => {
    const resultIds = new Set(searchResults.map(b => b.id));
    setSelectedBooks(prev => prev.filter(b => !resultIds.has(b.id)));
  };

  const handleRemoveSelected = (bookId) => {
    setSelectedBooks(prev => prev.filter(b => b.id !== bookId));
  };

  const handleSave = async () => {
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
        const response = await booksAPI.bulkUpdate(bookIds, bulkUpdates);
        setResult(response.data.results);
      }

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
    const token = localStorage.getItem('token');
    return `/api/books/${book.id}/cover?token=${token}`;
  };

  const isBookSelected = (bookId) => selectedBooks.some(b => b.id === bookId);

  const renderStepContent = () => {
    if (activeStep === 0) {
      // Step 1: Search and Select Books
      return (
        <Box>
          {/* Search Bar */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              placeholder="Search by title, author, or series..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setHasSearched(false);
                    }}>
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button 
              variant="contained" 
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
            >
              {searching ? <CircularProgress size={24} /> : 'Search'}
            </Button>
          </Box>

          {/* Search Results */}
          {hasSearched && (
            <Paper variant="outlined" sx={{ mb: 2 }}>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                p: 1,
                bgcolor: 'grey.100',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}>
                <Typography variant="subtitle2">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                </Typography>
                {searchResults.length > 0 && (
                  <Box>
                    <Tooltip title="Select all results">
                      <IconButton size="small" onClick={handleSelectAll}>
                        <SelectAllIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Deselect all results">
                      <IconButton size="small" onClick={handleDeselectAll}>
                        <DeselectIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>
              
              <List sx={{ maxHeight: 250, overflow: 'auto' }} dense>
                {searchResults.length === 0 ? (
                  <ListItem>
                    <ListItemText 
                      primary="No books found" 
                      secondary="Try a different search term"
                    />
                  </ListItem>
                ) : (
                  searchResults.map((book) => (
                    <ListItem 
                      key={book.id} 
                      button 
                      onClick={() => handleToggleBook(book)}
                      selected={isBookSelected(book.id)}
                    >
                      <Checkbox
                        edge="start"
                        checked={isBookSelected(book.id)}
                        icon={<CheckBoxBlankIcon />}
                        checkedIcon={<CheckBoxIcon />}
                      />
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
                          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                            {book.author}
                            {book.series && (
                              <Chip 
                                size="small" 
                                label={`${book.series}${book.series_number ? ` #${book.series_number}` : ''}`}
                                sx={{ ml: 0.5, height: 18, fontSize: '0.7rem' }}
                              />
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))
                )}
              </List>
            </Paper>
          )}

          {/* Selected Books Summary */}
          <Paper variant="outlined" sx={{ p: 2, bgcolor: selectedBooks.length > 0 ? 'primary.50' : 'grey.50' }}>
            <Typography variant="subtitle2" gutterBottom>
              Selected Books ({selectedBooks.length})
            </Typography>
            {selectedBooks.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Search and select books to edit
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 120, overflow: 'auto' }}>
                {selectedBooks.map((book) => (
                  <Chip
                    key={book.id}
                    label={`${book.title} - ${book.author}`}
                    onDelete={() => handleRemoveSelected(book.id)}
                    size="small"
                    sx={{ maxWidth: 250 }}
                  />
                ))}
              </Box>
            )}
          </Paper>
        </Box>
      );
    }

    // Step 2: Edit Fields
    return (
      <Box>
        {/* Selected Books Preview */}
        <Typography variant="subtitle2" gutterBottom>
          Editing {selectedBooks.length} Book{selectedBooks.length !== 1 ? 's' : ''}:
        </Typography>
        <Box sx={{ maxHeight: 120, overflow: 'auto', mb: 3, bgcolor: 'grey.50', borderRadius: 1 }}>
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
                          sx={{ ml: 1, height: 18, fontSize: '0.7rem' }}
                        />
                      )}
                    </>
                  }
                />
                {autoNumberSeries && (
                  <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold' }}>
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
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Autocomplete
              freeSolo
              options={seriesOptions}
              loading={loadingSeries}
              value={updates.series}
              onInputChange={(event, newValue) => {
                setUpdates({ ...updates, series: newValue });
              }}
              sx={{ flex: 2, minWidth: 200 }}
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
                <FormControl sx={{ minWidth: 140 }}>
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

          <TextField
            fullWidth
            label="Categories"
            value={updates.categories}
            onChange={(e) => setUpdates({ ...updates, categories: e.target.value })}
            helperText="Comma-separated list of categories"
          />

          <TextField
            fullWidth
            label="Language"
            value={updates.language}
            onChange={(e) => setUpdates({ ...updates, language: e.target.value })}
            placeholder="e.g., en, es, fr"
          />

          <TextField
            fullWidth
            label="Publisher"
            value={updates.publisher}
            onChange={(e) => setUpdates({ ...updates, publisher: e.target.value })}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

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
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EditIcon />
        Bulk Edit Books
      </DialogTitle>

      <DialogContent dividers>
        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {renderStepContent()}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Box>
          {activeStep > 0 && !result && (
            <Button 
              onClick={() => setActiveStep(0)} 
              startIcon={<BackIcon />}
            >
              Back
            </Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} startIcon={<CancelIcon />}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          
          {activeStep === 0 && (
            <Button
              variant="contained"
              onClick={() => setActiveStep(1)}
              endIcon={<NextIcon />}
              disabled={selectedBooks.length === 0}
            >
              Next ({selectedBooks.length} selected)
            </Button>
          )}
          
          {activeStep === 1 && !result && (
            <Button
              variant="contained"
              onClick={handleSave}
              startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
              disabled={saving}
            >
              Update {selectedBooks.length} Book{selectedBooks.length !== 1 ? 's' : ''}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default BulkEditModal;
