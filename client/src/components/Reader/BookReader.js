import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReactReader } from 'react-reader';
import { AppBar, Toolbar, IconButton, Typography, Box } from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { booksAPI } from '../../services/api';

const BookReader = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [location, setLocation] = useState(0);

  useEffect(() => {
    loadBook();
  }, [id]);

  const loadBook = async () => {
    try {
      const response = await booksAPI.getById(id);
      setBook(response.data.book);
    } catch (error) {
      console.error('Error loading book:', error);
    }
  };

  const bookUrl = booksAPI.getStreamUrl(id);

   // Custom fetch function that adds auth token to all EPUB requests

  console.log('[BookReader] Stream URL:', bookUrl);

 

  // Custom fetch function that adds auth token to all EPUB requests

  const customFetch = (input, init) => {

    const token = localStorage.getItem('token');

    const url = new URL(input, window.location.origin);

 

    // Add token to query string if not already present

    if (token && !url.searchParams.has('token')) {

      url.searchParams.append('token', token);

    }

 

    console.log('[BookReader] Fetching:', url.toString());

    return fetch(url.toString(), init);

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

        </Toolbar>

      </AppBar>

 

      <Box sx={{ flexGrow: 1, position: 'relative' }}>

        {book && (

          <ReactReader

            url={bookUrl}

            location={location}

            locationChanged={(epubcfi) => setLocation(epubcfi)}

            loadOptions={{

              requestMethod: customFetch

            }}
            getRendition={(rendition) => {
              rendition.themes.default({
                '::selection': {
                  background: 'rgba(255, 255, 0, 0.3)',
                },
                body: {
                  background: '#0f0f0f !important',
                  color: '#e0e0e0 !important',
                },
              });
            }}
          />
        )}
      </Box>
    </Box>
  );
};

export default BookReader;
