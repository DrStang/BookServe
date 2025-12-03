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
  DialogActions,
  TextField,
  Button,
  Snackbar,
  Alert,
  Rating,
  Box,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  MenuBook as ReadIcon,
  Download as DownloadIcon,
  Email as EmailIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { booksAPI, emailAPI } from '../../services/api';
import BookDetails from '../BookDetails/BookDetails';
import BookDetailModal from '../Books/BookDetailModal';

const BookCard = ({ book, onUpdate, readingProgress, onClick }) => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [coverError, setCoverError] = useState(false);

  // Reset cover error when book changes (e.g., when metadata is refreshed)
  useEffect(() => {
    setCoverError(false);
  }, [book.cover_image, book.id]);

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
      const response = await booksAPI.download(book.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${book.title}.${book.format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setSnackbar({ open: true, message: 'Download started', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Download failed', severity: 'error' });
    }
    handleMenuClose();
  };

  const handleEmailSubmit = async () => {
    try {
      await emailAPI.sendBook(book.id, email);
      setSnackbar({ open: true, message: 'Book sent to email', severity: 'success' });
      setEmailDialogOpen(false);
      setEmail('');
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to send email', severity: 'error' });
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
          <IconButton 
                onClick={(e) => {
                  e.stopPropagation();
                  handleMenuOpen
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

      <Dialog open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)}>
        <DialogTitle>Send Book to Email</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Email Address"
            type="email"
            fullWidth
            variant="outlined"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEmailSubmit} variant="contained">
            Send
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
        //bookId={book.id}
        book={book}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        //onRead={handleRead}
        //onDownload={handleDownload}
        onEmail={() => setEmailDialogOpen(true)}
        readingProgress={readingProgress}
          //onUpdate={() => {
         // setDetailsOpen(false);
         // if(onUpdate) onUpdate();
        //}}  
      /> 
    </>
  );
};

export default BookCard;
