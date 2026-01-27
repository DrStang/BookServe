// FulfillDialog.jsx - Updated version
// Replace client/src/components/Requests/FulfillDialog.jsx with this file

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Autocomplete,
  Link,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Email as EmailIcon,
  MenuBook as BookIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { requestsAPI, booksAPI } from '../../services/api';

const FulfillDialog = ({ open, onClose, request, onFulfillSuccess }) => {
  const [notes, setNotes] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  // Reset state when dialog opens
  useEffect(() => {
    if (open && request) {
      setNotes('');
      setSelectedBook(null);
      setError(null);
      setSuccess(false);
      setSearchInput(request.title || '');
      
      // Search for matching books when dialog opens
      searchMatchingBooks(request.title);
    }
  }, [open, request]);

  const searchMatchingBooks = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      setBooks([]);
      return;
    }
    
    setLoadingBooks(true);
    try {
      // Use the search endpoint which handles text search properly
      const response = await booksAPI.search(searchTerm);
      setBooks(response.data.books || []);
    } catch (err) {
      console.error('Error searching for books:', err);
      // Try fallback to getAll with title filter
      try {
        const fallbackResponse = await booksAPI.getAll(20, 0, 'title', 'ASC', {});
        // Filter client-side
        const filtered = (fallbackResponse.data.books || []).filter(book => 
          book.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          book.author?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setBooks(filtered.slice(0, 20));
      } catch (fallbackErr) {
        console.error('Fallback search also failed:', fallbackErr);
        setBooks([]);
      }
    } finally {
      setLoadingBooks(false);
    }
  };

  // Debounced search when user types
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput && searchInput.length >= 2) {
        searchMatchingBooks(searchInput);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleFulfill = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await requestsAPI.markAsFulfilled(request.id, {
        bookId: selectedBook?.id || null,
        notes: notes || 'Manually added by admin'
      });

      if (response.data.success) {
        setSuccess(true);
        // Wait a moment to show success, then close
        setTimeout(() => {
          onFulfillSuccess?.();
          onClose();
        }, 1500);
      } else {
        setError(response.data.message || 'Failed to mark as fulfilled');
      }
    } catch (err) {
      console.error('Error marking as fulfilled:', err);
      setError(err.response?.data?.error || 'Failed to mark request as fulfilled');
    } finally {
      setLoading(false);
    }
  };

  if (!request) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CheckCircleIcon color="success" />
        Mark as Fulfilled
      </DialogTitle>
      
      <DialogContent>
        {success ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" color="success.main" gutterBottom>
              Request Marked as Fulfilled!
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'text.secondary' }}>
              <EmailIcon fontSize="small" />
              <Typography variant="body2">
                User has been notified that the book is available
              </Typography>
            </Box>
          </Box>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Typography variant="body1" gutterBottom>
              Mark this failed request as fulfilled after manually adding the book to the library.
            </Typography>

            <Box sx={{ 
              bgcolor: 'action.hover', 
              p: 2, 
              borderRadius: 1, 
              my: 2 
            }}>
              <Typography variant="subtitle2" color="text.secondary">
                Request Details
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {request.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                by {request.author || 'Unknown Author'}
              </Typography>
              {request.isbn && (
                <Typography variant="caption" color="text.secondary">
                  ISBN: {request.isbn}
                </Typography>
              )}
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This will:
            </Typography>
            <Box component="ul" sx={{ mt: 0, pl: 2, color: 'text.secondary' }}>
              <li>
                <Typography variant="body2">Change status to "Completed"</Typography>
              </li>
              <li>
                <Typography variant="body2">Cancel any scheduled download retries</Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <EmailIcon fontSize="inherit" />
                    Send email to user ({request.username}) that book is available
                  </Box>
                </Typography>
              </li>
            </Box>

            <Autocomplete
              sx={{ mt: 3 }}
              options={books}
              getOptionLabel={(option) => `${option.title} - ${option.author || 'Unknown'}`}
              value={selectedBook}
              onChange={(_, newValue) => setSelectedBook(newValue)}
              inputValue={searchInput}
              onInputChange={(_, newInputValue) => setSearchInput(newInputValue)}
              loading={loadingBooks}
              filterOptions={(x) => x} // Disable client-side filtering, we handle it server-side
              isOptionEqualToValue={(option, value) => option.id === value?.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Link to Book (Optional)"
                  placeholder="Search for the book in library..."
                  helperText="Optionally link this request to the book you added"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingBooks ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <BookIcon fontSize="small" color="action" />
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2">{option.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.author || 'Unknown'} • {option.format?.toUpperCase() || 'Unknown format'}
                      </Typography>
                    </Box>
                  </Box>
                </li>
              )}
            />

            {/* Show link to selected book */}
            {selectedBook && (
              <Box sx={{ 
                mt: 2, 
                p: 1.5, 
                bgcolor: 'success.main', 
                bgcolor: 'rgba(46, 125, 50, 0.1)',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'success.main'
              }}>
                <Typography variant="subtitle2" color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <BookIcon fontSize="small" />
                  Linked Book
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {selectedBook.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedBook.author || 'Unknown'} • {selectedBook.format?.toUpperCase()}
                    </Typography>
                  </Box>
                  <Link 
                    href={`/book/${selectedBook.id}`}
                    target="_blank"
                    rel="noopener"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                  >
                    <Typography variant="caption">View</Typography>
                    <OpenInNewIcon fontSize="small" />
                  </Link>
                </Box>
              </Box>
            )}

            <TextField
              fullWidth
              label="Notes (Optional)"
              placeholder="e.g., Found on different source, converted format..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={2}
              sx={{ mt: 2 }}
            />
          </>
        )}
      </DialogContent>

      <DialogActions>
        {!success && (
          <>
            <Button onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleFulfill}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
            >
              {loading ? 'Processing...' : 'Mark as Fulfilled'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default FulfillDialog;
