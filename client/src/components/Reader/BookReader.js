import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReactReader } from 'react-reader';
import { AppBar, Toolbar, IconButton, Typography, Box, LinearProgress } from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { booksAPI, progressAPI } from '../../services/api';

const BookReader = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [location, setLocation] = useState(0);
  const [rendition, setRendition] = useState(null);
  const [progress, setProgress] = useState(0);
  const [locationsReady, setLocationsReady] = useState(false);
  const saveTimeoutRef = useRef(null);
  const bookRef = useRef(null);

  useEffect(() => {
    loadBook();
    loadProgress();
    // Reset locations when book changes
    setLocationsReady(false);
    bookRef.current = null;
  }, [id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!rendition) return;

      // Check if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          // Navigate to previous page
          rendition.prev();
          break;
        case 'ArrowRight':
        case 'PageDown':
        case ' ': // Spacebar
          e.preventDefault();
          // Navigate to next page
          rendition.next();
          break;
        case 'Escape':
          e.preventDefault();
          navigate('/');
          break;
        case 'Home':
          e.preventDefault();
          // Go to beginning of book
          rendition.display(0);
          break;
        case 'End':
          e.preventDefault();
          // Go to end of book (if spine is available)
          if (rendition.book && rendition.book.spine) {
            const lastSection = rendition.book.spine.get(rendition.book.spine.length - 1);
            if (lastSection) {
              rendition.display(lastSection.href);
            }
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rendition, navigate]);

  const loadBook = async () => {
    try {
      const response = await booksAPI.getById(id);
      setBook(response.data.book);
    } catch (error) {
      console.error('Error loading book:', error);
    }
  };

  const loadProgress = async () => {
    try {
      const response = await progressAPI.getBookProgress(id);
      const savedProgress = response.data.progress;

      if (savedProgress && savedProgress.current_location) {
        setLocation(savedProgress.current_location);
        setProgress(savedProgress.progress || 0);
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const saveProgress = async (currentLocation) => {
    try {
      // Calculate progress percentage using EPUB.js locations
      let progressPercent = 0;

      if (bookRef.current && currentLocation && locationsReady) {
        // Use the book's locations to calculate actual percentage through the whole book
        const percentage = bookRef.current.locations.percentageFromCfi(currentLocation);
        if (percentage !== null && !isNaN(percentage)) {
          progressPercent = Math.round(percentage * 100);
        }
      }

      await progressAPI.updateBookProgress(id, progressPercent, currentLocation);
      setProgress(progressPercent);
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const handleLocationChanged = (epubcfi) => {
    setLocation(epubcfi);

    // Debounce progress saving to avoid too many API calls
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveProgress(epubcfi);
    }, 2000); // Save 2 seconds after user stops navigating
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const token = localStorage.getItem('token');
  const bookUrl = booksAPI.getStreamUrl(id);

  console.log('[BookReader] Stream URL:', bookUrl);

  // Custom fetch function that adds auth token to all EPUB requests
  const customFetch = (url, type, withCredentials, headers) => {
    const token = localStorage.getItem('token');

    // Handle both relative and absolute URLs
    let fullUrl;
    try {
      fullUrl = new URL(url, window.location.origin);
    } catch (e) {
      // If input is already absolute, use it directly
      fullUrl = new URL(url);
    }

    // Add token to query string if not already present
    if (token && !fullUrl.searchParams.has('token')) {
      fullUrl.searchParams.append('token', token);
    }

    console.log('[BookReader] Fetching:', url.toString());
    
    return fetch(fullUrl.toString(), {
      headers: headers || {}
    }).then(response => response.arrayBuffer());  
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" sx={{ backgroundColor: '#1a1a1a' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {book?.title || 'Loading...'}
          </Typography>
          {progress > 0 && (
            <Typography variant="body2" sx={{ mr: 2 }}>
              {progress}%
            </Typography>
          )}
        </Toolbar>
        {progress > 0 && (
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 2,
              backgroundColor: 'rgba(255,255,255,0.1)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: '#e50914'
              }
            }}
          />
        )}
      </AppBar>

      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        {book && (
          <ReactReader
            url={bookUrl}
            location={location}
            locationChanged={handleLocationChanged}
            epubInitOptions={{
              requestMethod: customFetch,
              openAs: 'epub'
            }}
            getRendition={(rend) => {
              setRendition(rend);
              rend.themes.default({
                '::selection': {
                  background: 'rgba(255, 255, 0, 0.3)',
                },
                body: {
                  background: '#0f0f0f !important',
                  color: '#e0e0e0 !important',
                },
              });

              // Store book reference and generate locations for accurate progress tracking
              bookRef.current = rend.book;
              rend.book.ready.then(() => {
                // Generate locations with ~1000 characters per location for good granularity
                return rend.book.locations.generate(1024);
              }).then(() => {
                setLocationsReady(true);
                console.log('[BookReader] Locations generated for progress tracking');
              }).catch(err => {
                console.warn('[BookReader] Failed to generate locations:', err);
              });
            }}
          />
        )}
      </Box>
    </Box>
  );
};

export default BookReader;
