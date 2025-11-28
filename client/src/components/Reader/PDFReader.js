import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Slider,
  TextField,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon
} from '@mui/icons-material';
import axios from 'axios';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PDFReader = ({ bookId, onClose }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const url = `/api/books/${bookId}/stream?token=${token}`;
    setPdfUrl(url);
  }, [bookId]);

  useEffect(() => {
    // Save progress on page change
    const saveProgress = async () => {
      try {
        const progress = ((pageNumber - 1) / (numPages || 1)) * 100;
        const token = localStorage.getItem('token');
        await axios.post(
          `/api/progress/${bookId}`,
          {
            progress,
            currentLocation: `page-${pageNumber}`
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
      } catch (error) {
        console.error('Failed to save progress:', error);
      }
    };

    if (numPages) {
      const timer = setTimeout(saveProgress, 2000);
      return () => clearTimeout(timer);
    }
  }, [pageNumber, numPages, bookId]);

  useEffect(() => {
    // Keyboard shortcuts
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'PageUp':
          goToPrevPage();
          break;
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          goToNextPage();
          break;
        case 'Home':
          setPageNumber(1);
          break;
        case 'End':
          setPageNumber(numPages || 1);
          break;
        case 'Escape':
          onClose();
          break;
        case '+':
        case '=':
          setScale((prev) => Math.min(prev + 0.1, 3));
          break;
        case '-':
          setScale((prev) => Math.max(prev - 0.1, 0.5));
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pageNumber, numPages, onClose]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);

    // Load saved progress
    const loadProgress = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`/api/progress/${bookId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.progress && response.data.progress.current_location) {
          const match = response.data.progress.current_location.match(/page-(\d+)/);
          if (match) {
            setPageNumber(parseInt(match[1]));
          }
        }
      } catch (error) {
        console.error('Failed to load progress:', error);
      }
    };

    loadProgress();
  };

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages || 1));
  };

  const handlePageInputChange = (e) => {
    const value = parseInt(e.target.value);
    if (value >= 1 && value <= numPages) {
      setPageNumber(value);
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.1, 0.5));
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: '#1a1a1a',
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Top AppBar */}
      <AppBar position="static" sx={{ bgcolor: '#2d2d2d' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onClose}>
            <CloseIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, ml: 2 }}>
            PDF Reader
          </Typography>

          {/* Page navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              color="inherit"
              onClick={() => setPageNumber(1)}
              disabled={pageNumber === 1}
            >
              <FirstPageIcon />
            </IconButton>
            <IconButton
              color="inherit"
              onClick={goToPrevPage}
              disabled={pageNumber === 1}
            >
              <PrevIcon />
            </IconButton>

            <TextField
              type="number"
              value={pageNumber}
              onChange={handlePageInputChange}
              inputProps={{
                min: 1,
                max: numPages,
                style: { textAlign: 'center', color: 'white' }
              }}
              sx={{
                width: '60px',
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' }
                }
              }}
              size="small"
            />

            <Typography>/ {numPages || '?'}</Typography>

            <IconButton
              color="inherit"
              onClick={goToNextPage}
              disabled={pageNumber === numPages}
            >
              <NextIcon />
            </IconButton>
            <IconButton
              color="inherit"
              onClick={() => setPageNumber(numPages || 1)}
              disabled={pageNumber === numPages}
            >
              <LastPageIcon />
            </IconButton>

            {/* Zoom controls */}
            <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton color="inherit" onClick={handleZoomOut}>
                <ZoomOutIcon />
              </IconButton>
              <Typography sx={{ minWidth: '50px', textAlign: 'center' }}>
                {Math.round(scale * 100)}%
              </Typography>
              <IconButton color="inherit" onClick={handleZoomIn}>
                <ZoomInIcon />
              </IconButton>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      {/* PDF Display */}
      <Box
        ref={containerRef}
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          p: 2,
          bgcolor: '#2a2a2a'
        }}
      >
        {loading && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%'
            }}
          >
            <CircularProgress />
          </Box>
        )}

        {pdfUrl && (
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<CircularProgress />}
            error={
              <Typography color="error">
                Failed to load PDF. Please try again.
              </Typography>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </Document>
        )}
      </Box>

      {/* Progress indicator */}
      {numPages && (
        <Box sx={{ px: 2, pb: 1, bgcolor: '#2d2d2d' }}>
          <Slider
            value={pageNumber}
            min={1}
            max={numPages}
            onChange={(e, value) => setPageNumber(value)}
            sx={{
              color: '#e50914',
              '& .MuiSlider-thumb': {
                width: 12,
                height: 12
              }
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export default PDFReader;
