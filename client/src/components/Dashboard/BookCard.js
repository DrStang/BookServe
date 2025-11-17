import React, { useState } from 'react';
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

const BookCard = ({ book, onUpdate }) => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [coverError, setCoverError] = useState(false);

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
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#1a1a1a',
          transition: 'transform 0.2s',
          '&:hover': {
            transform: 'scale(1.05)',
            cursor: 'pointer',
          },
        }}
      >
        <CardMedia
          component="img"
          height="300"
          image={book.cover_image && !coverError ? booksAPI.getCoverUrl(book.id) : defaultCover}
          alt={book.title}
          onClick={handleRead}
          onError={() => setCoverError(true)}
          sx={{ objectFit: 'cover' }}
        />
        <CardContent sx={{ flexGrow: 1 }}>
          <Typography gutterBottom variant="h6" component="div" noWrap>
            {book.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
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
        <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
          <IconButton color="primary" onClick={handleRead} title="Read">
            <ReadIcon />
          </IconButton>
          <IconButton onClick={handleMenuOpen} title="More options">
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

      <BookDetails
        bookId={book.id}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        onRead={handleRead}
        onDownload={handleDownload}
        onEmail={() => setEmailDialogOpen(true)}
        onUpdate={() => {
          setDetailsOpen(false);
          if(onUpdate) onUpdate();
        }}  
      />
    </>
  );
};

export default BookCard;
