import React, { useRef, useEffect, useState } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import { Box } from '@mui/material';
import BookCard from './BookCard';

const VirtualizedBookGrid = ({ books, readingProgress, onUpdate, onBookClick, columnCount = 6, cardWidth = 250, cardHeight = 450 }) => {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Update container width on mount and resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Calculate dynamic column count based on container width
  const dynamicColumnCount = containerWidth > 0
    ? Math.floor(containerWidth / cardWidth) || 1
    : columnCount;

  const rowCount = Math.ceil(books.length / dynamicColumnCount);

  // Cell renderer for each grid cell
  const Cell = ({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * dynamicColumnCount + columnIndex;

    if (index >= books.length) {
      return null;
    }

    const book = books[index];

    return (
      <Box
        style={style}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          p: 1.5,
        }}
      >
        <Box sx={{ width: '100%', maxWidth: cardWidth - 24 }}>
          <BookCard
            book={book}
            onUpdate={onUpdate}
            readingProgress={readingProgress[book.id]}
            onClick={() => onBookClick(book)}
          />
        </Box>
      </Box>
    );
  };

  if (containerWidth === 0) {
    return <Box ref={containerRef} sx={{ width: '100%', height: '100vh' }} />;
  }

  return (
    <Box ref={containerRef} sx={{ width: '100%' }}>
      <Grid
        columnCount={dynamicColumnCount}
        columnWidth={cardWidth}
        height={800} // Fixed height for the scrollable area
        rowCount={rowCount}
        rowHeight={cardHeight}
        width={containerWidth}
        style={{
          overflowX: 'hidden',
        }}
      >
        {Cell}
      </Grid>
    </Box>
  );
};

export default VirtualizedBookGrid;
