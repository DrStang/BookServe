import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  Link,
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
      console.error('Error loading similar books:', error);
    } finally {
      setLoadingSimilar(false);
    }
  };

  const handleEdit = () => {
    setEditedBook({ ...currentBook });
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditedBook({});
    setDeleteConfirm(false);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await booksAPI.update(currentBook.id, {
        title: editedBook.title,
        author: editedBook.author,
        isbn: editedBook.isbn,
        publisher: editedBook.publisher,
        published_date: editedBook.published_date,
        series: editedBook.series || null,
        series_number: editedBook.series_number || null,
        description: editedBook.description,
        categories: editedBook.categories,
        language: editedBook.language,
      });
      
      // Reload book data
      const response = await booksAPI.getById(currentBook.id);
      setCurrentBook(response.data.book);
      setEditing(false);
      setSnackbar({ open: true, message: 'Book updated successfully', severity: 'success' });
      
      // Notify parent to refresh if callback provided
      if (onBookUpdated) {
        onBookUpdated();
      }
    } catch (error) {
      console.error('Error updating book:', error);
      setSnackbar({ open: true, message: 'Failed to update book', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    
    try {
      await booksAPI.delete(currentBook.id);
      setSnackbar({ open: true, message: 'Book deleted successfully', severity: 'success' });
      onClose();
      // Notify parent to refresh if callback provided
      if (onBookUpdated) {
        onBookUpdated();
      }
    } catch (error) {
      console.error('Error deleting book:', error);
      setSnackbar({ open: true, message: 'Failed to delete book', severity: 'error' });
    }
  };

  const handleRefreshMetadata = async () => {
    try {
      setRefreshing(true);
      await metadataAPI.refreshBookMetadata(currentBook.id, true);
      
      // Reload book data
      const response = await booksAPI.getById(currentBook.id);
      setCurrentBook(response.data.book);
      setSnackbar({ open: true, message: 'Metadata refreshed successfully', severity: 'success' });
      
      // Notify parent to refresh if callback provided
      if (onBookUpdated) {
        onBookUpdated();
      }
    } catch (error) {
      console.error('Error refreshing metadata:', error);
      setSnackbar({ open: true, message: 'Failed to refresh metadata', severity: 'error' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleDownload = async () => {
    if (!currentBook) return;

    try {
      // Convert to EPUB if the book is in a convertible format (mobi, azw, azw3)
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
    } catch (error) {
      console.error('Download failed:', error);
      setSnackbar({ open: true, message: 'Download failed', severity: 'error' });
    }
  };

  const handleRead = () => {
    if (!currentBook) return;
    navigate(`/read/${currentBook.id}`);
    onClose();
  };

  const handleAuthorClick = () => {
    if (!currentBook?.author) return;
    navigate(`/author/${encodeURIComponent(currentBook.author)}`);
    onClose();
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
      // Convert to EPUB if the book is in a convertible format (mobi, azw, azw3)
      const format = needsEpubConversion(currentBook.format) ? 'epub' : null;
      await emailAPI.sendBook(currentBook.id, email, format);
      let message = 'Book sent to email';
      if (saveEmail) {
        message += ' (email saved for future use)';
        setHasSavedEmail(true);
      }  
      setSnackbar({ open: true, message: message, severity: 'success' });
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

  if (!currentBook) return null;

  const progress = readingProgress?.[currentBook.id];
  const coverUrl = currentBook.coverUrl || booksAPI.getCoverUrl(currentBook.id);
  const categories = currentBook.categories ? currentBook.categories.split(',').map(c => c.trim()) : [];

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
            maxHeight: '90vh',
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 2 }}>
          <Typography variant="h5" component="div">
            {editing ? 'Edit Book' : 'Book Details'}
          </Typography>
          <Box>
            {!editing && (
              <>
                <IconButton onClick={handleEdit} title="Edit book" size="small" sx={{ mr: 1 }}>
                  <EditIcon />
                </IconButton>
                <IconButton 
                  onClick={handleRefreshMetadata} 
                  disabled={refreshing}
                  title="Refresh metadata" 
                  size="small" 
                  sx={{ mr: 1 }}
                >
                  {refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
                </IconButton>
                <IconButton 
                  onClick={handleDelete}
                  title={deleteConfirm ? 'Click again to confirm' : 'Delete book'}
                  color={deleteConfirm ? 'error' : 'default'}
                  size="small"
                  sx={{ mr: 1 }}
                >
                  <DeleteIcon />
                </IconButton>
              </>
            )}
            <IconButton onClick={editing ? handleCancelEdit : onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          <Grid container spacing={3}>
            {/* Book Cover and Basic Info */}
            <Grid item xs={12} md={4}>
              <Box
                component="img"
                src={coverUrl}
                alt={currentBook.title}
                sx={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: 400,
                  objectFit: 'cover',
                  borderRadius: 2,
                  mb: 2,
                }}
              />

              {/* Action Buttons - Only show when not editing */}
              {!editing && (
                <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<ReadIcon />}
                    onClick={handleRead}
                    sx={{
                      backgroundColor: '#e50914',
                      '&:hover': { backgroundColor: '#b20710' },
                    }}
                  >
                    {progress && progress.progress > 0 ? 'Continue Reading' : 'Read'}
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<DownloadIcon />}
                    onClick={handleDownload}
                  >
                    Download
                  </Button>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<EmailIcon />}
                    onClick={handleEmailClick}
                  >
                    Email
                  </Button>
                </Box>
              )}
            </Grid>

            {/* Book Details */}
            <Grid item xs={12} md={8}>
              {editing ? (
                // ========== EDIT MODE ==========
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    fullWidth
                    label="Title"
                    value={editedBook.title || ''}
                    onChange={(e) => setEditedBook({ ...editedBook, title: e.target.value })}
                    variant="outlined"
                  />
                  <TextField
                    fullWidth
                    label="Author"
                    value={editedBook.author || ''}
                    onChange={(e) => setEditedBook({ ...editedBook, author: e.target.value })}
                    variant="outlined"
                  />
                  
                  {/* Series with Autocomplete */}
                  <Grid container spacing={2}>
                    <Grid item xs={8}>
                      <Autocomplete
                        freeSolo
                        options={seriesOptions}
                        loading={loadingSeries}
                        value={editedBook.series || ''}
                        onInputChange={(event, newValue) => {
                          setEditedBook({ ...editedBook, series: newValue });
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Series"
                            placeholder="Enter or select series"
                            InputProps={{
                              ...params.InputProps,
                              startAdornment: (
                                <>
                                  <SeriesIcon sx={{ mr: 1, color: 'action.active' }} />
                                  {params.InputProps.startAdornment}
                                </>
                              ),
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
                    </Grid>
                    <Grid item xs={4}>
                      <TextField
                        fullWidth
                        label="Series #"
                        type="number"
                        value={editedBook.series_number || ''}
                        onChange={(e) => setEditedBook({ ...editedBook, series_number: e.target.value })}
                        variant="outlined"
                        InputProps={{ inputProps: { min: 0, step: 0.5 } }}
                      />
                    </Grid>
                  </Grid>

                  <TextField
                    fullWidth
                    label="ISBN"
                    value={editedBook.isbn || ''}
                    onChange={(e) => setEditedBook({ ...editedBook, isbn: e.target.value })}
                    variant="outlined"
                  />
                  <TextField
                    fullWidth
                    label="Publisher"
                    value={editedBook.publisher || ''}
                    onChange={(e) => setEditedBook({ ...editedBook, publisher: e.target.value })}
                    variant="outlined"
                  />
                  <TextField
                    fullWidth
                    label="Published Date"
                    value={editedBook.published_date || ''}
                    onChange={(e) => setEditedBook({ ...editedBook, published_date: e.target.value })}
                    variant="outlined"
                    placeholder="YYYY or YYYY-MM-DD"
                  />
                  <TextField
                    fullWidth
                    label="Language"
                    value={editedBook.language || ''}
                    onChange={(e) => setEditedBook({ ...editedBook, language: e.target.value })}
                    variant="outlined"
                    placeholder="e.g., en, es, fr"
                  />
                  <TextField
                    fullWidth
                    label="Categories"
                    value={editedBook.categories || ''}
                    onChange={(e) => setEditedBook({ ...editedBook, categories: e.target.value })}
                    variant="outlined"
                    helperText="Comma-separated list of categories"
                  />
                  <TextField
                    fullWidth
                    label="Description"
                    value={editedBook.description || ''}
                    onChange={(e) => setEditedBook({ ...editedBook, description: e.target.value })}
                    variant="outlined"
                    multiline
                    rows={4}
                  />
                </Box>
              ) : (
                // ========== VIEW MODE ==========
                <>
                  <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
                    {currentBook.title}
                  </Typography>

                  {currentBook.author && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <AuthorIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                      <Typography
                        variant="h6"
                        onClick={handleAuthorClick}
                        sx={{
                          cursor: 'pointer',
                          color: 'text.secondary',
                          '&:hover': {
                            color: '#e50914',
                            textDecoration: 'underline',
                          },
                        }}
                      >
                        {currentBook.author}
                      </Typography>
                    </Box>
                  )}

                  {/* Rating */}
                  {currentBook.average_rating && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Rating value={currentBook.average_rating} readOnly precision={0.1} size="small" />
                      <Typography variant="body2" color="text.secondary">
                        {currentBook.average_rating.toFixed(1)}
                        {currentBook.ratings_count && ` (${currentBook.ratings_count} ratings)`}
                      </Typography>
                    </Box>
                  )}

                  {/* Reading Progress */}
                  {progress && progress.progress > 0 && (
                    <Chip
                      label={`${Math.round(progress.progress)}% Complete`}
                      sx={{
                        backgroundColor: '#e50914',
                        mb: 2,
                      }}
                    />
                  )}

                  {/* Categories */}
                  {categories.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      {categories.map((category, index) => (
                        <Chip
                          key={index}
                          label={category}
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5, backgroundColor: '#333' }}
                        />
                      ))}
                    </Box>
                  )}

                  {/* Metadata */}
                  <Box sx={{ mb: 2 }}>
                    {currentBook.series && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <SeriesIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          Series: {currentBook.series}
                          {currentBook.series_number && ` #${currentBook.series_number}`}
                        </Typography>
                      </Box>
                    )}
                    {currentBook.published_date && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <CalendarIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          Published: {currentBook.published_date}
                        </Typography>
                      </Box>
                    )}
                    {currentBook.publisher && (
                      <Typography variant="body2" color="text.secondary">
                        Publisher: {currentBook.publisher}
                      </Typography>
                    )}
                    {currentBook.isbn && (
                      <Typography variant="body2" color="text.secondary">
                        ISBN: {currentBook.isbn}
                      </Typography>
                    )}
                    {currentBook.page_count && (
                      <Typography variant="body2" color="text.secondary">
                        Pages: {currentBook.page_count}
                      </Typography>
                    )}
                    {currentBook.language && (
                      <Typography variant="body2" color="text.secondary">
                        Language: {currentBook.language.toUpperCase()}
                      </Typography>
                    )}
                    {currentBook.format && (
                      <Typography variant="body2" color="text.secondary">
                        Format: {currentBook.format.toUpperCase()}
                      </Typography>
                    )}
                  </Box>

                  {/* Description */}
                  {currentBook.description && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="h6" gutterBottom>
                        Description
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        {currentBook.description}
                      </Typography>
                    </>
                  )}
                </>
              )}
            </Grid>
          </Grid>

          {/* Similar Books Section - Only show when not editing */}
          {!editing && similarBooks.length > 0 && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ReadIcon />
                Similar Books You Might Like
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {similarBooks.map((similarBook) => (
                  <Grid item xs={6} sm={4} md={2} key={similarBook.id}>
                    <Box
                      onClick={() => {
                        onClose();
                        setTimeout(() => {
                          window.dispatchEvent(new CustomEvent('openBookDetail', { detail: similarBook }));
                        }, 100);
                      }}
                      sx={{
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                        '&:hover': {
                          transform: 'scale(1.05)',
                        },
                      }}
                    >
                      <Box
                        component="img"
                        src={booksAPI.getCoverUrl(similarBook.id)}
                        alt={similarBook.title}
                        sx={{
                          width: '100%',
                          height: 'auto',
                          aspectRatio: '2/3',
                          objectFit: 'cover',
                          borderRadius: 1,
                          mb: 0.5,
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          fontSize: '0.7rem',
                        }}
                      >
                        {similarBook.title}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </>
          )}

          {loadingSimilar && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Loading similar books...
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
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

      {/* Email Dialog */}
      <Dialog 
        open={emailDialogOpen} 
        onClose={handleEmailDialogClose}
        maxWidth="sm"
        fullWidth
      >    
        <DialogTitle>Send Book to Email</DialogTitle>
        <DialogContent>
        <DialogContentText sx ={{ fontSize: '0.875rem', mb: 2 }}>
            Ensure dandolewski@gmail.com is in 'Approved Personal Document E-mail List' in your 
              <Link
                href="https://www.amazon.com/hz/mycd/preferences/myx#/home/settings/payment"
                target="_blank"
                rel="noopener"
                sx={{ ml: 0.5 }}
              >
                Amazon settings
              </Link>    
          </DialogContentText>  
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
          <Button onClick={() => {handleEmailDialogClose}>Cancel</Button>
          <Button onClick={handleEmailSubmit} 
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
