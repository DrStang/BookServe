import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Button,
  Snackbar,
  Alert,
  Rating,
  Box,
  LinearProgress,
  Chip,
  Link,
  Checkbox,
  CircularProgress,
  FormControlLabel,
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  MenuBook as ReadIcon,
  Download as DownloadIcon,
  Email as EmailIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { booksAPI, emailAPI } from '../../services/api';
import BookDetailModal from '../Books/BookDetailModal';
import AddToCollectionButton from "../Collections/AddToCollectionButton";

// Helper to check if book format needs conversion to EPUB
const needsEpubConversion = (format) => {
  const convertibleFormats = ['mobi', 'azw', 'azw3'];
  return convertibleFormats.includes(format?.toLowerCase());
};

const BookCard = ({ book, onUpdate, readingProgress, onClick }) => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [saveEmail, setSaveEmail] = useState(false);
  const [hasSavedEmail, setHasSavedEmail] = useState(false);
  const [loadingSavedEmail, setLoadingSavedEmail] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [coverError, setCoverError] = useState(false);

  // Reset cover error when book changes (e.g., when metadata is refreshed)
  useEffect(() => {
    setCoverError(false);
  }, [book.cover_image, book.id]);

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

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleRead = () => {
    navigate(`/read/${book.id}`);
  };

  const handleDownload = async () => {
    try {
      const format = needsEpubConversion(book.format) ? 'epub' : null;
      const downloadFormat = format || book.format;

      const response = await booksAPI.download(book.id, format);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${book.title}.${downloadFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setSnackbar({ open: true, message: 'Download started', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Download failed', severity: 'error' });
    }
    handleMenuClose();
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
      const bookRef = currentBook || book; // currentBook for modal, book for BookCard/BookPage
      const format = needsEpubConversion(bookRef.format) ? 'epub' : null;
      const response = await emailAPI.sendBook(bookRef.id, email, format, saveEmail);
      
      let message = response.data.message || 'Book sent to email';
      if (response.data.downloadLink) {
        message = 'Book too large to attach — a download link was sent instead.';
      }
      if (saveEmail) {
        message += ' (email saved for future use)';
        setHasSavedEmail(true);
      }
      
      setSnackbar({ open: true, message, severity: 'success' });
      handleEmailDialogClose();
    } catch (error) {
      const errorData = error.response?.data;
      
      if (error.response?.status === 413 && errorData?.isKindle) {
        // Kindle address but book too large
        setSnackbar({ 
          open: true, 
          message: `Book is too large for email (${errorData.sizeMB?.toFixed(1)}MB). Please download directly or use OPDS to access on your Kindle.`,
          severity: 'warning' 
        });
      } else {
        setSnackbar({ 
          open: true, 
          message: errorData?.message || 'Failed to send email', 
          severity: 'error' 
        });
      }
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
              '&:hover': book.author ? {
                color: '#e50914',
                textDecoration: 'underline'
              } : {}
            }}
          >
            {book.author || 'Unknown Author'}
          </Typography>
          {book.average_rating && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
              <Rating value={book.average_rating} precision={0.5} size="small" readOnly />
              <Typography variant="caption" sx={{ ml: 0.5 }}>
                ({book.average_rating.toFixed(1)})
              </Typography>
            </Box>
          )}
        </CardContent>
        {readingProgress && readingProgress.progress > 0 && (
          <Box sx={{ px: 2, pb: 1 }}>
            <LinearProgress
              variant="determinate"
              value={readingProgress.progress}
              sx={{
                height: 4,
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.1)',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: '#e50914',
                  borderRadius: 2,
                }
              }}
            />
          </Box>
        )}
        <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
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
          <Box onClick={(e) => e.stopPropagation()}>
            <AddToCollectionButton
              bookId={book.id}
              bookTitle={book.title}
              size="small"
              color="inherit"
            />
          </Box>

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

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onClose={handleEmailDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Send Book to Email</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.875rem', mb: 2 }}>
            ATTENTION - NEW EMAIL - UPDATE! Ensure PLEX@DRSTANG.XYZ is in 'Approved Personal Document E-mail List' in your 
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
        autoHideDuration={6000}
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
