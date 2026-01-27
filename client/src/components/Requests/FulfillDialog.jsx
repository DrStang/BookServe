// FulfillDialog.jsx - Add to client/src/components/Requests/FulfillDialog.jsx

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
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Email as EmailIcon,
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

  // Reset state when dialog opens
  useEffect(() => {
    if (open && request) {
      setNotes('');
      setSelectedBook(null);
      setError(null);
      setSuccess(false);
      
      // Search for matching books when dialog opens
      searchMatchingBooks();
    }
  }, [open, request]);

  const searchMatchingBooks = async () => {
    if (!request) return;
    
    setLoadingBooks(true);
    try {
      // Search for books matching the request title/author
      const response = await booksAPI.getAll({ 
        search: request.title,
        limit: 20 
      });
      setBooks(response.data.books || []);
    } catch (err) {
      console.error('Error searching for books:', err);
      // Non-fatal, just means no autocomplete
    } finally {
      setLoadingBooks(false);
    }
  };

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
              loading={loadingBooks}
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
                  <Box>
                    <Typography variant="body2">{option.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.author || 'Unknown'} • {option.format?.toUpperCase()}
                    </Typography>
                  </Box>
                </li>
              )}
            />

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
