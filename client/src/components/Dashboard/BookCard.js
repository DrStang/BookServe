import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Typography,
  IconButton,
  Chip,
  Box,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Snackbar,
  Alert,
  FormControlLabel,
  Checkbox,
  CircularProgress,
} from '@mui/material';
import {
  Download as DownloadIcon,
  MoreVert as MoreIcon,
  Info as InfoIcon,
  Email as EmailIcon,
  MenuBook as ReadIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { booksAPI, emailAPI } from '../../services/api';
import BookDetailModal from '../Books/BookDetailModal';

const BookCard = ({ book, onClick, onUpdate, readingProgress }) => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [saveEmail, setSaveEmail] = useState(false);
  const [hasSavedEmail, setHasSavedEmail] = useState(false);
  const [loadingSavedEmail, setLoadingSavedEmail] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const [sending, setSending] = useState(false);

  // Fetch saved email when dialog opens
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
        setSaveEmail(false); // Don't show save checkbox if already saved
      } else {
        setHasSavedEmail(false);
      }
    } catch (error) {
      console.error('Error fetching saved email:', error);
    } finally {
      setLoadingSavedEmail(false);
    }
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDownload = async () => {
    handleMenuClose();
    try {
      const response = await booksAPI.download(book.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${book.title}.${book.format || 'epub'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSnackbar({ open: true, message: 'Download started', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Download failed', severity: 'error' });
    }
  };

  const handleRead = () => {
    navigate(`/read/${book.id}`);
  };

  const handleEmailDialogClose = () => {
    setEmailDialogOpen(false);
    // Reset state when closing
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
      // Determine format - convert to EPUB if needed
      const needsConversion = ['mobi', 'azw', 'azw3', 'pdf'].includes(book.format?.toLowerCase());
      const format = needsConversion ? 'epub' : null;
      
      await emailAPI.sendBook(book.id, email, format, saveEmail);
      
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

  const defaultCover = `https://via.placeholder.com/300x450/1a1a1a/ffffff?text=${encodeURIComponent(
    book.title
  )}`;

  return (
    <>
      <Card
        onClick={onClick}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#1a1a1a',
          transition: 'transform 0.2s',
          cursor: 'pointer',
          '&:hover': {
            transform: 'scale(1.05)',
          },
        }}
      >
        <Box sx={{ position: 'relative' }}>
          <CardMedia
            component="img"
            height="300"
            image={book.cover_image && !coverError ? booksAPI.getCoverUrl(book.id) : defaultCover}
            alt={book.title}
            onError={() => setCoverError(true)}
            sx={{ objectFit: 'contain' }}
          />
          {readingProgress && readingProgress.progress > 0 && (
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
              }}
            >
              <Chip
                label={`${Math.round(readingProgress.progress)}%`}
                size="small"
                sx={{
                  backgroundColor: 'rgba(229, 9, 20, 0.9)',
                  color: 'white',
                  fontWeight: 'bold',
                }}
              />
            </Box>
          )}
        </Box>
        <CardContent sx={{ flexGrow: 1 }}>
          <Typography gutterBottom variant="h6" component="div" noWrap>
            {book.title}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            noWrap
            onClick={(e) => {
              e.stopPropagation();
              if (book.author) {
                navigate(`/author/${encodeURIComponent(book.author)}`);
              }
            }}
            sx={{
              cursor: book.author ? 'pointer' : 'default',
              '&:hover': book.author ? { color: '#e50914' } : {},
            }}
          >
            {book.author || 'Unknown Author'}
          </Typography>
        </CardContent>
        <CardActions sx={{ justifyContent: 'space-between' }}>
          <IconButton
            color="primary"
            onClick={(e) => {
              e.stopPropagation();
              handleRead();
            }}
            title={readingProgress && readingProgress.progress > 0 ? 'Continue Reading' : 'Read'}
          >
            <ReadIcon />
          </IconButton>
          <IconButton
            color="primary"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            title="Download"
          >
            <DownloadIcon />
          </IconButton>
          <IconButton
            color="primary"
            onClick={(e) => {
              e.stopPropagation();
              setEmailDialogOpen(true);
            }}
            title="Send to Email"
          >
            <EmailIcon />
          </IconButton>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              handleMenuOpen(e);
            }}
            title="More options"
          >
            <MoreIcon />
          </IconButton>
        </CardActions>
      </Card>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem
          onClick={() => {
            setDetailsOpen(true);
            handleMenuClose();
          }}
        >
          <InfoIcon sx={{ mr: 1 }} /> View Details
        </MenuItem>
        <MenuItem onClick={handleDownload}>
          <DownloadIcon sx={{ mr: 1 }} /> Download
        </MenuItem>
        <MenuItem
          onClick={() => {
            setEmailDialogOpen(true);
            handleMenuClose();
          }}
        >
          <EmailIcon sx={{ mr: 1 }} /> Send to Email
        </MenuItem>
      </Menu>

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

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>

      <BookDetailModal
        book={book}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        onEmail={() => setEmailDialogOpen(true)}
        readingProgress={readingProgress}
      />
    </>
  );
};

export default BookCard;
