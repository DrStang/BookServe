import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  Close as CloseIcon,
  MenuBook as ReadIcon,
  Download as DownloadIcon,
  Person as AuthorIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { booksAPI } from '../../services/api';
import BookCard from '../Dashboard/BookCard';

const BookDetailModal = ({ open, onClose, book, readingProgress }) => {
  const navigate = useNavigate();
  const [similarBooks, setSimilarBooks] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  useEffect(() => {
    if (open && book) {
      loadSimilarBooks();
    }
  }, [open, book]);

  const loadSimilarBooks = async () => {
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
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleRead = () => {
    navigate(`/read/${book.id}`);
    onClose();
  };

  const handleAuthorClick = () => {
    navigate(`/author/${encodeURIComponent(book.author)}`);
    onClose();
  };

  if (!book) return null;

  const progress = readingProgress[book.id];
  const coverUrl = booksAPI.getCoverUrl(book.id);
  const categories = book.categories ? book.categories.split(',').map(c => c.trim()) : [];

  return (
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
          Book Details
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* Book Cover and Basic Info */}
          <Grid item xs={12} md={4}>
            <Box
              component="img"
              src={coverUrl}
              alt={book.title}
              sx={{
                width: '100%',
                height: 'auto',
                maxHeight: 400,
                objectFit: 'cover',
                borderRadius: 2,
                mb: 2,
              }}
            />

            {/* Action Buttons */}
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
            </Box>
          </Grid>

          {/* Book Details */}
          <Grid item xs={12} md={8}>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
              {book.title}
            </Typography>

            {book.author && (
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
                  {book.author}
                </Typography>
              </Box>
            )}

            {/* Rating */}
            {book.average_rating && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Rating value={book.average_rating} readOnly precision={0.1} size="small" />
                <Typography variant="body2" color="text.secondary">
                  {book.average_rating.toFixed(1)}
                  {book.ratings_count && ` (${book.ratings_count} ratings)`}
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
              {book.published_date && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <CalendarIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    Published: {book.published_date}
                  </Typography>
                </Box>
              )}
              {book.publisher && (
                <Typography variant="body2" color="text.secondary">
                  Publisher: {book.publisher}
                </Typography>
              )}
              {book.isbn && (
                <Typography variant="body2" color="text.secondary">
                  ISBN: {book.isbn}
                </Typography>
              )}
              {book.page_count && (
                <Typography variant="body2" color="text.secondary">
                  Pages: {book.page_count}
                </Typography>
              )}
              {book.language && (
                <Typography variant="body2" color="text.secondary">
                  Language: {book.language.toUpperCase()}
                </Typography>
              )}
              {book.format && (
                <Typography variant="body2" color="text.secondary">
                  Format: {book.format.toUpperCase()}
                </Typography>
              )}
              {book.series && (
                <Typography variant="body2" color="text.secondary">
                  Series: {book.series} {book.series_number && `#${book.series_number}`}
                </Typography>
              )}
            </Box>

            {/* Description */}
            {book.description && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Description
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  {book.description}
                </Typography>
              </>
            )}
          </Grid>
        </Grid>

        {/* Similar Books Section */}
        {similarBooks.length > 0 && (
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
                      // Small delay to ensure modal closes before opening new one
                      setTimeout(() => {
                        // Trigger parent to open new modal with new book
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
        <Button onClick={onClose} color="inherit">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BookDetailModal;
