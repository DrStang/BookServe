import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  FormControlLabel,
  Checkbox,
  Paper,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { goodreadsAPI } from '../../services/api';

const GoodreadsImport = ({ open, onClose, onImportComplete }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [error, setError] = useState(null);
  const [createRequests, setCreateRequests] = useState(true);

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setPreview(null);
    setImportResults(null);

    // Preview the CSV
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('csv', selectedFile);

      const response = await goodreadsAPI.previewCSV(formData);
      setPreview(response.data);
    } catch (err) {
      console.error('Error previewing CSV:', err);
      setError(err.response?.data?.error || 'Error previewing CSV file');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    try {
      setLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append('csv', file);
      formData.append('createRequests', createRequests);

      const response = await goodreadsAPI.importCSV(formData);
      setImportResults(response.data.summary);

      // Notify parent component
      if (onImportComplete) {
        onImportComplete(response.data.summary);
      }
    } catch (err) {
      console.error('Error importing CSV:', err);
      setError(err.response?.data?.error || 'Error importing CSV file');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    setImportResults(null);
    setError(null);
    setCreateRequests(true);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Import Goodreads Library</DialogTitle>

      <DialogContent dividers>
        {/* Instructions */}
        {!file && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" paragraph>
              Export your Goodreads library as a CSV file:
            </Typography>
            <Typography variant="body2" component="ol" sx={{ pl: 2 }}>
              <li>Go to Goodreads → My Books</li>
              <li>Click "Import and export" at the bottom</li>
              <li>Click "Export Library" to download your CSV file</li>
              <li>Upload the CSV file below</li>
            </Typography>
          </Box>
        )}

        {/* File Upload */}
        {!importResults && (
          <Box sx={{ mb: 3 }}>
            <input
              accept=".csv"
              style={{ display: 'none' }}
              id="csv-file-input"
              type="file"
              onChange={handleFileChange}
            />
            <label htmlFor="csv-file-input">
              <Button
                variant="contained"
                component="span"
                startIcon={<UploadIcon />}
                fullWidth
                sx={{
                  backgroundColor: '#e50914',
                  '&:hover': { backgroundColor: '#b20710' },
                }}
              >
                {file ? 'Change File' : 'Select CSV File'}
              </Button>
            </label>
            {file && (
              <Typography variant="caption" display="block" sx={{ mt: 1, textAlign: 'center' }}>
                Selected: {file.name}
              </Typography>
            )}
          </Box>
        )}

        {/* Loading */}
        {loading && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress />
            <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
              Processing CSV file...
            </Typography>
          </Box>
        )}

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Preview */}
        {preview && !importResults && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Preview ({preview.totalBooks} books found)
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              First 10 books from your export:
            </Typography>
            <Paper sx={{ maxHeight: 300, overflow: 'auto', backgroundColor: '#1a1a1a' }}>
              <List dense>
                {preview.preview.map((book, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemText
                        primary={book.title}
                        secondary={
                          <>
                            <Typography component="span" variant="body2" color="text.secondary">
                              by {book.author}
                            </Typography>
                            {book.shelf && (
                              <Typography component="span" variant="caption" sx={{ ml: 1 }}>
                                • {book.shelf}
                              </Typography>
                            )}
                            {book.rating > 0 && (
                              <Typography component="span" variant="caption" sx={{ ml: 1 }}>
                                • ⭐ {book.rating}
                              </Typography>
                            )}
                          </>
                        }
                      />
                    </ListItem>
                    {index < preview.preview.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Paper>

            <FormControlLabel
              control={
                <Checkbox
                  checked={createRequests}
                  onChange={(e) => setCreateRequests(e.target.checked)}
                />
              }
              label="Create book requests for books not in library"
              sx={{ mt: 2 }}
            />
          </Box>
        )}

        {/* Import Results */}
        {importResults && (
          <Box>
            <Alert severity="success" icon={<SuccessIcon />} sx={{ mb: 3 }}>
              Import completed successfully!
            </Alert>

            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Summary
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Paper sx={{ p: 2, backgroundColor: '#1a1a1a' }}>
                  <Typography variant="caption" color="text.secondary">
                    Total Books
                  </Typography>
                  <Typography variant="h4">{importResults.total}</Typography>
                </Paper>
                <Paper sx={{ p: 2, backgroundColor: '#1a1a1a' }}>
                  <Typography variant="caption" color="text.secondary">
                    Already in Library
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {importResults.matched}
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2, backgroundColor: '#1a1a1a' }}>
                  <Typography variant="caption" color="text.secondary">
                    Not Found
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    {importResults.notFound}
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2, backgroundColor: '#1a1a1a' }}>
                  <Typography variant="caption" color="text.secondary">
                    Requests Created
                  </Typography>
                  <Typography variant="h4" color="info.main">
                    {importResults.requestsCreated}
                  </Typography>
                </Paper>
              </Box>
            </Box>

            {importResults.errors > 0 && (
              <Alert severity="warning" icon={<ErrorIcon />}>
                {importResults.errors} book(s) had errors during import
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} color="inherit">
          {importResults ? 'Close' : 'Cancel'}
        </Button>
        {preview && !importResults && (
          <Button
            onClick={handleImport}
            variant="contained"
            disabled={loading}
            sx={{
              backgroundColor: '#e50914',
              '&:hover': { backgroundColor: '#b20710' },
            }}
          >
            Import {preview.totalBooks} Books
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default GoodreadsImport;
