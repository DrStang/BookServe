import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  Typography,
  Slider,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

const AdvancedSearch = ({ open, onClose, onSearch }) => {
  const [searchCriteria, setSearchCriteria] = useState({
    title: '',
    author: '',
    isbn: '',
    publisher: '',
    yearFrom: '',
    yearTo: '',
    ratingFrom: 0,
    ratingTo: 5,
    categories: '',
    language: '',
    format: '',
  });

  const handleChange = (field, value) => {
    setSearchCriteria(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSearch = () => {
    // Filter out empty values
    const criteria = Object.entries(searchCriteria).reduce((acc, [key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        // Skip rating if it's the default range
        if (key === 'ratingFrom' && value === 0) return acc;
        if (key === 'ratingTo' && value === 5) return acc;
        acc[key] = value;
      }
      return acc;
    }, {});

    onSearch(criteria);
    onClose();
  };

  const handleReset = () => {
    setSearchCriteria({
      title: '',
      author: '',
      isbn: '',
      publisher: '',
      yearFrom: '',
      yearTo: '',
      ratingFrom: 0,
      ratingTo: 5,
      categories: '',
      language: '',
      format: '',
    });
  };

  const currentYear = new Date().getFullYear();
  const ratingMarks = [
    { value: 0, label: '0' },
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
    { value: 4, label: '4' },
    { value: 5, label: '5' },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#1a1a1a',
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SearchIcon />
        Advanced Search
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Grid container spacing={3}>
            {/* Title */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Title"
                value={searchCriteria.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Enter book title"
                variant="outlined"
              />
            </Grid>

            {/* Author */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Author"
                value={searchCriteria.author}
                onChange={(e) => handleChange('author', e.target.value)}
                placeholder="Enter author name"
                variant="outlined"
              />
            </Grid>

            {/* ISBN */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="ISBN"
                value={searchCriteria.isbn}
                onChange={(e) => handleChange('isbn', e.target.value)}
                placeholder="Enter ISBN (10 or 13)"
                variant="outlined"
              />
            </Grid>

            {/* Publisher */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Publisher"
                value={searchCriteria.publisher}
                onChange={(e) => handleChange('publisher', e.target.value)}
                placeholder="Enter publisher name"
                variant="outlined"
              />
            </Grid>

            {/* Publication Year Range */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Publication Year (From)"
                type="number"
                value={searchCriteria.yearFrom}
                onChange={(e) => handleChange('yearFrom', e.target.value)}
                placeholder="e.g., 2000"
                variant="outlined"
                inputProps={{ min: 1800, max: currentYear }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Publication Year (To)"
                type="number"
                value={searchCriteria.yearTo}
                onChange={(e) => handleChange('yearTo', e.target.value)}
                placeholder="e.g., 2024"
                variant="outlined"
                inputProps={{ min: 1800, max: currentYear }}
              />
            </Grid>

            {/* Rating Range */}
            <Grid item xs={12}>
              <Typography gutterBottom>
                Rating Range: {searchCriteria.ratingFrom} - {searchCriteria.ratingTo} stars
              </Typography>
              <Slider
                value={[searchCriteria.ratingFrom, searchCriteria.ratingTo]}
                onChange={(e, newValue) => {
                  handleChange('ratingFrom', newValue[0]);
                  handleChange('ratingTo', newValue[1]);
                }}
                valueLabelDisplay="auto"
                min={0}
                max={5}
                step={0.5}
                marks={ratingMarks}
                sx={{
                  color: '#e50914',
                  '& .MuiSlider-thumb': {
                    backgroundColor: '#e50914',
                  },
                  '& .MuiSlider-track': {
                    backgroundColor: '#e50914',
                  },
                  '& .MuiSlider-rail': {
                    backgroundColor: '#555',
                  },
                }}
              />
            </Grid>

            {/* Categories/Genres */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Categories/Genres"
                value={searchCriteria.categories}
                onChange={(e) => handleChange('categories', e.target.value)}
                placeholder="e.g., Fiction, Science"
                variant="outlined"
                helperText="Comma-separated for multiple"
              />
            </Grid>

            {/* Language */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Language</InputLabel>
                <Select
                  value={searchCriteria.language}
                  onChange={(e) => handleChange('language', e.target.value)}
                  label="Language"
                >
                  <MenuItem value="">Any</MenuItem>
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="es">Spanish</MenuItem>
                  <MenuItem value="fr">French</MenuItem>
                  <MenuItem value="de">German</MenuItem>
                  <MenuItem value="it">Italian</MenuItem>
                  <MenuItem value="pt">Portuguese</MenuItem>
                  <MenuItem value="ru">Russian</MenuItem>
                  <MenuItem value="zh">Chinese</MenuItem>
                  <MenuItem value="ja">Japanese</MenuItem>
                  <MenuItem value="ko">Korean</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Format */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Format</InputLabel>
                <Select
                  value={searchCriteria.format}
                  onChange={(e) => handleChange('format', e.target.value)}
                  label="Format"
                >
                  <MenuItem value="">Any</MenuItem>
                  <MenuItem value="epub">EPUB</MenuItem>
                  <MenuItem value="pdf">PDF</MenuItem>
                  <MenuItem value="mobi">MOBI</MenuItem>
                  <MenuItem value="azw">AZW</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* Active Filters Preview */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Active Filters:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {Object.entries(searchCriteria).map(([key, value]) => {
                if (value === '' || value === null || value === undefined) return null;
                if (key === 'ratingFrom' && value === 0) return null;
                if (key === 'ratingTo' && value === 5) return null;

                let label = '';
                switch (key) {
                  case 'title': label = `Title: ${value}`; break;
                  case 'author': label = `Author: ${value}`; break;
                  case 'isbn': label = `ISBN: ${value}`; break;
                  case 'publisher': label = `Publisher: ${value}`; break;
                  case 'yearFrom': label = `Year from: ${value}`; break;
                  case 'yearTo': label = `Year to: ${value}`; break;
                  case 'ratingFrom': label = `Rating ≥ ${value}`; break;
                  case 'ratingTo': label = `Rating ≤ ${value}`; break;
                  case 'categories': label = `Categories: ${value}`; break;
                  case 'language': label = `Language: ${value}`; break;
                  case 'format': label = `Format: ${value.toUpperCase()}`; break;
                  default: label = `${key}: ${value}`;
                }

                return (
                  <Chip
                    key={key}
                    label={label}
                    size="small"
                    sx={{ backgroundColor: '#e50914' }}
                  />
                );
              })}
              {Object.values(searchCriteria).every(v => !v || v === 0 || v === 5) && (
                <Typography variant="caption" color="text.secondary">
                  No filters applied
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleReset} color="inherit">
          Reset
        </Button>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSearch}
          variant="contained"
          startIcon={<SearchIcon />}
          sx={{
            backgroundColor: '#e50914',
            '&:hover': {
              backgroundColor: '#b20710',
            },
          }}
        >
          Search
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AdvancedSearch;
