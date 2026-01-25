import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Chip,
  IconButton,
  Rating,
  Divider,
  TextField,
  CircularProgress,
  Snackbar,
  Alert,
  Autocomplete,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Close as CloseIcon,
  MenuBook as ReadIcon,
  Download as DownloadIcon,
  Person as AuthorIcon,
  CalendarToday as CalendarIcon,
  Edit as EditIcon,
  Email as EmailIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  CollectionsBookmark as SeriesIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { booksAPI, metadataAPI, emailAPI } from '../../services/api';

// Helper to check if book format needs conversion to EPUB
const needsEpubConversion = (format) => {
  const convertibleFormats = ['mobi', 'azw', 'azw3'];
  return convertibleFormats.includes(format?.toLowerCase());
};

const BookDetailModal = ({ open, onClose, onEmail, book, readingProgress, onBookUpdated, isAdmin = false }) => {
  const navigate = useNavigate();
  const [similarBooks, setSimilarBooks] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedBook, setEditedBook] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentBook, setCurrentBook] = useState(book);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [saveEmail, setSaveEmail] = useState(false);
  const [hasSavedEmail, setHasSavedEmail] = useState(false);
  const [loadingSavedEmail, setLoadingSavedEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [saving, setSaving] = useState(false);
  const [seriesOptions, setSeriesOptions] = useState([]);
  const [loadingSeries, setLoadingSeries] = useState(false);

  // Fetch series list for autocomplete
  const fetchSeriesList = useCallback(async () => {
    if (seriesOptions.length > 0) return;

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
  }, [seriesOptions.length]);

  useEffect(() => {
    if (open && book) {
      setCurrentBook(book);
      setEditing(false);
      setDeleteConfirm(false);
      setEmailDialogOpen(false);
      loadSimilarBooks();
    }
  }, [open, book]);

  // Fetch series options when entering edit mode
  useEffect(() => {
    if (editing) {
      fetchSeriesList();
    }
  }, [editing, fetchSeriesList]);

  // Fetch saved email when email dialog opens
  useEffect(() => {
    if (emailDialogOpen) {
      fetchSavedEmail();
    }
  }, [emailDialogOpen]);

  const fetchSavedEmail = async () => {
    setLoadingSavedEmail(true);
    try {
      const response = await emailAPI.getSavedEmail();
      const savedEmail = response.data.kindle_email;
      if (savedEmail) {
        setEmail(savedEmail);
        setHasSavedEmail(true);
        setSaveEmail(false);
      } else {
        setHasSavedEmail(false);
      }
    } catch (error) {
      console.error('Error fetching saved email:', error);
    } finally {
      setLoadingSavedEmail(false);
    }
  };

  const loadSimilarBooks = async () => {
    if (!book) return;
    
    try {
      setLoadingSimilar(true);
      const response = await booksAPI.getSimilar(book.id, 6);
      setSimilarBooks(response.data.books);
    } catch (error) {
      console.error('Failed to load similar books:', error);
    } finally {
      setLoadingSimilar(false);
    }
  };

  const handleRead = () => {
    onClose();
    navigate(`/read/${currentBook.id}`);
  };

  const handleDownload = async () => {
    try {
      const format = needsEpubConversion(currentBook.format) ? 'epub' : null;
      const downloadFormat = format || currentBook.format;
      
      const response = await booksAPI.download(currentBook.id, format);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${currentBook.title}.${downloadFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setSnackbar({ open: true, message: 'Download started', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Download failed', severity: 'error' });
    }
  };

  const handleEmailDialogOpen = () => {
    setEmailDialogOpen(true);
  };

  const handleEmailDialogClose = () => {
    setEmailDialogOpen(false);
    if (!hasSavedEmail) {
      setEmail('');
    }
    setSaveEmail(false);
  };

  const handleEmailSubmit = async () => {
    if (!email) {
      setSnackbar({ open: true, message: 'Please enter an email address', severity: 'warning' });
      return;
    }

    setSending(true);
    try {
      const format = needsEpubConversion(currentBook.format) ? 'epub' : null;
      await emailAPI.sendBook(currentBook.id, email, format, saveEmail);
      
      let message = 'Book sent to email';
      if (saveEmail) {
        message += ' (email saved for future use)';
        setHasSavedEmail(true);
      }
      
      setSnackbar({ open: true, message, severity: 'success' });
      handleEmailDialogClose();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to send email', severity: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleClearSavedEmail = async () => {
    try {
      await emailAPI.clearSavedEmail();
      setEmail('');
      setHasSavedEmail(false);
      setSnackbar({ open: true, message: 'Saved email cleared', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to clear saved email', severity: 'error' });
    }
  };

  const handleRefreshMetadata = async () => {
    try {
      setRefreshing(true);
      const response = await metadataAPI.refreshBook(currentBook.id);
      setCurrentBook(response.data.book);
      setSnackbar({ open: true, message: 'Metadata refreshed successfully', severity: 'success' });
      if (onBookUpdated) {
        onBookUpdated(response.data.book);
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to refresh metadata', severity: 'error' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleStartEdit = () => {
    setEditedBook({
      title: currentBook.title || '',
      author: currentBook.author || '',
      description: currentBook.description || '',
      isbn: currentBook.isbn || '',
      publisher: currentBook.publisher || '',
      published_date: currentBook.published_date || '',
      categories: currentBook.categories || '',
      series: currentBook.series || '',
      series_number: currentBook.series_number || '',
    });
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditedBook({});
  };

  const handleSaveEdit = async () => {
    try {
      setSaving(true);
      const response = await booksAPI.update(currentBook.id, editedBook);
      setCurrentBook({ ...currentBook, ...editedBook });
      setEditing(false);
      setSnackbar({ open: true, message: 'Book updated successfully', severity: 'success' });
      if (onBookUpdated) {
        onBookUpdated({ ...currentBook, ...editedBook });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to update book', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await booksAPI.delete(currentBook.id);
      setSnackbar({ open: true, message: 'Book deleted successfully', severity: 'success' });
      onClose();
      if (onBookUpdated) {
        onBookUpdated(null);
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to delete book', severity: 'error' });
    }
  };

  if (!currentBook) return null;

  const defaultCover = `https://via.placeholder.com/200x300/1a1a1a/ffffff?text=${encodeURIComponent(currentBook.title)}`;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#1a1a1a',
            backgroundImage: 'none',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" component="span">
            {editing ? 'Edit Book' : 'Book Details'}
          </Typography>
          <Box>
            {!editing && isAdmin && (
              <>
                <IconButton onClick={handleRefreshMetadata} disabled={refreshing} title="Refresh metadata">
                  {refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
                </IconButton>
                <IconButton onClick={handleStartEdit} title="Edit">
                  <EditIcon />
                </IconButton>
                <IconButton onClick={() => setDeleteConfirm(true)} color="error" title="Delete">
                  <DeleteIcon />
                </IconButton>
              </>
            )}
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {editing ? (
            // Edit Mode
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Title"
                  value={editedBook.title}
                  onChange={(e) => setEditedBook({ ...editedBook, title: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Author"
                  value={editedBook.author}
                  onChange={(e) => setEditedBook({ ...editedBook, author: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  freeSolo
                  options={seriesOptions}
                  loading={loadingSeries}
                  value={editedBook.series || ''}
                  onChange={(e, newValue) => setEditedBook({ ...editedBook, series: newValue || '' })}
                  onInputChange={(e, newValue) => setEditedBook({ ...editedBook, series: newValue || '' })}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Series"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: <SeriesIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Series Number"
                  type="number"
                  value={editedBook.series_number}
                  onChange={(e) => setEditedBook({ ...editedBook, series_number: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="ISBN"
                  value={editedBook.isbn}
                  onChange={(e) => setEditedBook({ ...editedBook, isbn: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Publisher"
                  value={editedBook.publisher}
                  onChange={(e) => setEditedBook({ ...editedBook, publisher: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Published Date"
                  value={editedBook.published_date}
                  onChange={(e) => setEditedBook({ ...editedBook, published_date: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Categories"
                  value={editedBook.categories}
                  onChange={(e) => setEditedBook({ ...editedBook, categories: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  multiline
                  rows={4}
                  value={editedBook.description}
                  onChange={(e) => setEditedBook({ ...editedBook, description: e.target.value })}
                />
              </Grid>
            </Grid>
          ) : (
            // View Mode
            <Grid container spacing={3}>
              <Grid item xs={12} sm={4}>
                <Box
                  component="img"
                  src={currentBook.cover_image ? booksAPI.getCoverUrl(currentBook.id) : defaultCover}
                  alt={currentBook.title}
                  sx={{
                    width: '100%',
                    maxHeight: 400,
                    objectFit: 'contain',
                    borderRadius: 1,
                  }}
                />
                
                {/* Action Buttons */}
                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    startIcon={<ReadIcon />}
                    onClick={handleRead}
                    sx={{ flex: 1 }}
                  >
                    {readingProgress && readingProgress.progress > 0 ? 'Continue' : 'Read'}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownload}
                    sx={{ flex: 1 }}
                  >
                    Download
                  </Button>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<EmailIcon />}
                  onClick={handleEmailDialogOpen}
                  fullWidth
                  sx={{ mt: 1 }}
                >
                  Email
                </Button>
              </Grid>

              <Grid item xs={12} sm={8}>
                <Typography variant="h5" gutterBottom>
                  {currentBook.title}
                </Typography>
                
                {currentBook.series && (
                  <Chip
                    icon={<SeriesIcon />}
                    label={`${currentBook.series}${currentBook.series_number ? ` #${currentBook.series_number}` : ''}`}
                    size="small"
                    sx={{ mb: 1 }}
                  />
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AuthorIcon fontSize="small" color="action" />
                  <Typography
                    variant="subtitle1"
                    sx={{ cursor: 'pointer', '&:hover': { color: '#e50914' } }}
                    onClick={() => {
                      onClose();
                      navigate(`/author/${encodeURIComponent(currentBook.author)}`);
                    }}
                  >
                    {currentBook.author || 'Unknown Author'}
                  </Typography>
                </Box>

                {currentBook.average_rating && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Rating value={currentBook.average_rating} precision={0.1} readOnly />
                    <Typography variant="body2" color="text.secondary">
                      {currentBook.average_rating.toFixed(1)} ({currentBook.ratings_count || 0} ratings)
                    </Typography>
                  </Box>
                )}

                <Divider sx={{ my: 2 }} />

                {currentBook.description && (
                  <Typography variant="body2" paragraph>
                    {currentBook.description}
                  </Typography>
                )}

                <Grid container spacing={2}>
                  {currentBook.publisher && (
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Publisher</Typography>
                      <Typography variant="body2">{currentBook.publisher}</Typography>
                    </Grid>
                  )}
                  {currentBook.published_date && (
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Published</Typography>
                      <Typography variant="body2">{currentBook.published_date}</Typography>
                    </Grid>
                  )}
                  {currentBook.isbn && (
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">ISBN</Typography>
                      <Typography variant="body2">{currentBook.isbn}</Typography>
                    </Grid>
                  )}
                  {currentBook.page_count && (
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Pages</Typography>
                      <Typography variant="body2">{currentBook.page_count}</Typography>
                    </Grid>
                  )}
                  {currentBook.categories && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">Categories</Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                        {currentBook.categories.split(',').map((cat, i) => (
                          <Chip key={i} label={cat.trim()} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </Grid>
            </Grid>
          )}
        </DialogContent>

        <DialogActions>
          {editing ? (
            <>
              <Button onClick={handleCancelEdit} startIcon={<CancelIcon />} color="inherit">
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSaveEdit}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                sx={{
                  backgroundColor: '#e50914',
                  '&:hover': { backgroundColor: '#b20710' },
                }}
              >
                Save Changes
              </Button>
            </>
          ) : (
            <Button onClick={onClose} color="inherit">
              Close
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm} onClose={() => setDeleteConfirm(false)}>
        <DialogTitle>Delete Book</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{currentBook.title}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Email Dialog with Save Option */}
      <Dialog 
        open={emailDialogOpen} 
        onClose={handleEmailDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Send Book to Email</DialogTitle>
        <DialogContent>
          {loadingSavedEmail ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <>
              <TextField
                autoFocus
                margin="dense"
                label="Email Address"
                type="email"
                fullWidth
                variant="outlined"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your-kindle@kindle.com"
                helperText={hasSavedEmail ? "Using your saved email address" : "Enter your Kindle or device email"}
              />
              
              {/* Show save option only if no email is currently saved */}
              {!hasSavedEmail && email && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={saveEmail}
                      onChange={(e) => setSaveEmail(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Save this email for future book deliveries"
                  sx={{ mt: 1 }}
                />
              )}

              {/* Show clear option if email is saved */}
              {hasSavedEmail && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    This is your saved email address.{' '}
                    <Button
                      size="small"
                      onClick={handleClearSavedEmail}
                      sx={{ textTransform: 'none', p: 0, minWidth: 'auto' }}
                    >
                      Clear saved email
                    </Button>
                  </Typography>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEmailDialogClose}>Cancel</Button>
          <Button 
            onClick={handleEmailSubmit} 
            variant="contained"
            disabled={sending || !email || loadingSavedEmail}
            startIcon={sending ? <CircularProgress size={16} /> : null}
          >
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </>
  );
};

export default BookDetailModal;
