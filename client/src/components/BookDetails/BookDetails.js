import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Typography,
  Box,
  Chip,
  Rating,
  IconButton,
  Divider,
  CircularProgress,
  TextField,
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  MenuBook as ReadIcon,
  Download as DownloadIcon,
  Email as EmailIcon,
  Info as InfoIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { booksAPI, metadataAPI } from '../../services/api';

const BookDetails = ({ bookId, open, onClose, onRead, onDownload, onEmail, onUpdate }) => {
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedBook, setEditedBook] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [coverError, setCoverError] = useState(false);

  useEffect(() => {
    if (open && bookId) {
      loadBookDetails();
    }
  }, [open, bookId]);

  const loadBookDetails = async () => {
    try {
      setLoading(true);
      const response = await booksAPI.getById(bookId);
      setBook(response.data.book);
    } catch (error) {
      console.error('Error loading book details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshMetadata = async () => {
    try {
      setRefreshing(true);
      await metadataAPI.refreshBookMetadata(bookId, true);
      await loadBookDetails();
    } catch (error) {
      console.error('Error refreshing metadata:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleEdit = () => {
    setEditedBook({ ...book });
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditedBook({});
  };

  const handleSaveEdit = async () => {
    try {
      await booksAPI.update(bookId, {
        title: editedBook.title,
        author: editedBook.author,
        isbn: editedBook.isbn,
        publisher: editedBook.publisher,
        published_date: editedBook.published_date,
      });
      setEditing(false);
      await loadBookDetails();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating book:', error);
      alert('Failed to update book');
    }
  };

  const handleDelete = async () => {
    if(!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    try {
      await booksAPI.delete(bookId);
      if(onUpdate) onUpdate();
      onClose();
    } catch(error) {
      console.error('Error deleting book:', error);
      alert('Failed to delete book');
    }
  };
  
  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { backgroundColor: '#1a1a1a' },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">{editing ? 'Edit Book' : 'Book Details'}</Typography>
        <Box>
          {!editing && (
            <>
              <IconButton
                onClick={handleEdit}
                title="Edit book"
              >
                <EditIcon />
              </IconButton>            
              <IconButton
                onClick={handleRefreshMetadata}
                disabled={refreshing}
                title="Refresh metadata"
              >
                {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
              </IconButton>
              <IconButton
                onClick={handleDelete}
                title={deleteConfirm ? 'Click again to confirm' : 'Delete book'}
                color={deleteConfirm ? 'error' : 'default'}
              >
                <DeleteIcon />
              </IconButton>
            </>
          )}  
          <IconButton onClick={editing ? handleCancelEdit : onClose}>
              <CloseIcon/>  
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : book ? (
          <Grid container spacing={3}>
            {/* Cover Image */}
            <Grid item xs={12} md={4}>
              <Box
                component="img"
                src={
                  book.cover_image && !coverError
                    ? booksAPI.getCoverUrl(book.id)
                    : `https://via.placeholder.com/300x450/1a1a1a/ffffff?text=${encodeURIComponent(
                        book.title
                      )}`
                }
                alt={book.title}
                onError={() => setCoverError(true)}
                sx={{
                  width: '100%',
                  borderRadius: 2,
                  boxShadow: 3,
                }}
              />
            </Grid>

            {/* Book Information */}
            <Grid item xs={12} md={8}>
              {editing ? (

                <>

                  <TextField

                     fullWidth

                     label="Title"

                     value={editedBook.title || ''}

                     onChange={(e) => setEditedBook({ ...editedBook, title: e.target.value })}

                     margin="normal"

                     variant="outlined"

                  />

                  <TextField

                      fullWidth

                      label="Author"

                      value={editedBook.author || ''}

                      onChange={(e) => setEditedBook({ ...editedBook, author: e.target.value })}

                      margin="normal"

                      variant="outlined"

                  />

                </>

              ) : (

                <>

                  <Typography variant="h4" gutterBottom>

                    {book.title}

                  </Typography>

                  <Typography variant="h6" color="text.secondary" gutterBottom>

                    {book.author || 'Unknown Author'}

                  </Typography>

                </>

              )}
              {/* Rating */}
              {book.average_rating && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Rating value={book.average_rating} precision={0.1} readOnly />
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    {book.average_rating.toFixed(1)}
                    {book.ratings_count && ` (${book.ratings_count.toLocaleString()} ratings)`}
                  </Typography>
                </Box>
              )}

              {/* Categories/Genres */}
              {book.categories && (
                <Box sx={{ mb: 2 }}>
                  {book.categories.split(',').slice(0, 5).map((category, index) => (
                    <Chip
                      key={index}
                      label={category.trim()}
                      size="small"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Metadata */}
              <Grid container spacing={2}>
                {book.publisher && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Publisher
                    </Typography>
                    <Typography variant="body1">{book.publisher}</Typography>
                  </Grid>
                )}

                {book.published_date && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Published
                    </Typography>
                    <Typography variant="body1">{book.published_date}</Typography>
                  </Grid>
                )}

                {book.page_count && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Pages
                    </Typography>
                    <Typography variant="body1">{book.page_count}</Typography>
                  </Grid>
                )}

                {book.language && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Language
                    </Typography>
                    <Typography variant="body1">{book.language.toUpperCase()}</Typography>
                  </Grid>
                )}

                {book.isbn && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      ISBN
                    </Typography>
                    <Typography variant="body1">{book.isbn}</Typography>
                  </Grid>
                )}

                {book.format && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Format
                    </Typography>
                    <Typography variant="body1">{book.format.toUpperCase()}</Typography>
                  </Grid>
                )}
              </Grid>

              {/* Description */}
              {book.description && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Description
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      maxHeight: 200,
                      overflow: 'auto',
                      textAlign: 'justify',
                    }}
                  >
                    {book.description}
                  </Typography>
                </>
              )}

              {/* External Links */}
              {(book.preview_link || book.info_link) && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {book.preview_link && (
                      <Button
                        size="small"
                        startIcon={<InfoIcon />}
                        href={book.preview_link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Preview
                      </Button>
                    )}
                    {book.info_link && (
                      <Button
                        size="small"
                        startIcon={<InfoIcon />}
                        href={book.info_link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        More Info
                      </Button>
                    )}
                  </Box>
                </>
              )}
            </Grid>
          </Grid>
        ) : (
          <Typography>Book not found</Typography>
        )}
      </DialogContent>

      <DialogActions>
        {editing ? (
          <>
            <Button onClick={handleCancelEdit} startIcon={<CancelIcon />}>
              Canel
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveEdit}
              startIcon={<SaveIcon />}
            >
              Save Changes
            </Button>    
          </>     
         ) : (
           <>
             <Button onClick={() => onEmail && onEmail(book)} startIcon={<EmailIcon />}>
               Send to Email
             </Button>
             <Button onClick={() => onDownload && onDownload(book)} startIcon={<DownloadIcon />}>
               Download
             </Button>
             <Button
               variant="contained"
               onClick={() => onRead && onRead(book)}
               startIcon={<ReadIcon />}
             >
               Read Now
             </Button>
            </>
         )}        
      </DialogActions>
    </Dialog>
  );
};

export default BookDetails;
