/**
 * Full-Text Search Admin Panel Component
 *
 * Admin interface for managing the full-text search index:
 * - View indexing statistics
 * - Trigger full library indexing
 * - Index individual books
 * - View indexing status per book
 *
 * Add this to your existing Admin page/panel.
 */

import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Chip,
    IconButton,
    CircularProgress,
    LinearProgress,
    Alert,
    Tooltip,
    TextField,
    InputAdornment,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Card,
    CardContent,
    Grid,
    Snackbar,
    Collapse,
} from '@mui/material';
import {
    Search as SearchIcon,
    Refresh as RefreshIcon,
    PlayArrow as IndexIcon,
    Delete as DeleteIcon,
    CheckCircle as SuccessIcon,
    Error as ErrorIcon,
    HourglassEmpty as PendingIcon,
    Storage as StorageIcon,
    MenuBook as BookIcon,
    TextFields as WordsIcon,
    Layers as ChaptersIcon,
    ExpandMore as ExpandIcon,
    ExpandLess as CollapseIcon,
} from '@mui/icons-material';
import { searchAPI } from '../../services/api';

const SearchIndexAdmin = () => {
    const [stats, setStats] = useState(null);
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [indexing, setIndexing] = useState(false);
    const [error, setError] = useState(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Table state
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [filter, setFilter] = useState('');
    const [expandedSection, setExpandedSection] = useState(true);

    // Confirmation dialog
    const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null, message: '' });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await searchAPI.getStatus();
            setStats(response.data.stats);
            setBooks(response.data.books || []);
            setIndexing(response.data.isIndexing);
        } catch (err) {
            console.error('Error loading search status:', err);
            setError(err.response?.data?.error || 'Failed to load search index status');
        } finally {
            setLoading(false);
        }
    };

    const handleIndexAll = async (force = false) => {
        setConfirmDialog({ open: false });
        try {
            setIndexing(true);
            showSnackbar('Indexing started. This may take a while...', 'info');
            await searchAPI.triggerIndex(force);

            // Poll for completion
            const pollInterval = setInterval(async () => {
                try {
                    const response = await searchAPI.getStatus();
                    setStats(response.data.stats);
                    setBooks(response.data.books || []);
                    if (!response.data.isIndexing) {
                        clearInterval(pollInterval);
                        setIndexing(false);
                        showSnackbar('Indexing complete!', 'success');
                    }
                } catch (e) {
                    clearInterval(pollInterval);
                    setIndexing(false);
                }
            }, 3000);
        } catch (err) {
            setIndexing(false);
            showSnackbar(err.response?.data?.error || 'Failed to start indexing', 'error');
        }
    };

    const handleIndexBook = async (bookId) => {
        try {
            showSnackbar('Indexing book...', 'info');
            await searchAPI.indexBook(bookId);
            await loadData();
            showSnackbar('Book indexed successfully', 'success');
        } catch (err) {
            showSnackbar(err.response?.data?.error || 'Failed to index book', 'error');
        }
    };

    const handleRemoveFromIndex = async (bookId) => {
        try {
            await searchAPI.removeFromIndex(bookId);
            await loadData();
            showSnackbar('Book removed from index', 'success');
        } catch (err) {
            showSnackbar(err.response?.data?.error || 'Failed to remove from index', 'error');
        }
    };

    const showSnackbar = (message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'indexed':
                return <SuccessIcon sx={{ color: '#22c55e', fontSize: 20 }} />;
            case 'error':
                return <ErrorIcon sx={{ color: '#ef4444', fontSize: 20 }} />;
            default:
                return <PendingIcon sx={{ color: '#888', fontSize: 20 }} />;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'indexed':
                return 'success';
            case 'error':
                return 'error';
            default:
                return 'default';
        }
    };

    // Filter books
    const filteredBooks = books.filter(book =>
        book.title?.toLowerCase().includes(filter.toLowerCase()) ||
        book.author?.toLowerCase().includes(filter.toLowerCase())
    );

    // Paginate
    const paginatedBooks = filteredBooks.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
    );

    if (loading && !stats) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress sx={{ color: '#e50914' }} />
            </Box>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SearchIcon sx={{ color: '#e50914' }} />
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 'bold' }}>
                        Full-Text Search Index
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Refresh status">
                        <IconButton onClick={loadData} disabled={loading} sx={{ color: '#888' }}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Stats Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} md={3}>
                    <Card sx={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <BookIcon sx={{ color: '#3b82f6', fontSize: 32, mb: 1 }} />
                            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold' }}>
                                {stats?.indexedBooks || 0}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#888' }}>
                                of {stats?.totalBooks || 0} books indexed
                            </Typography>
                            <LinearProgress
                                variant="determinate"
                                value={stats?.percentIndexed || 0}
                                sx={{
                                    mt: 1,
                                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                    '& .MuiLinearProgress-bar': { backgroundColor: '#3b82f6' },
                                }}
                            />
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={6} md={3}>
                    <Card sx={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <WordsIcon sx={{ color: '#22c55e', fontSize: 32, mb: 1 }} />
                            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold' }}>
                                {((stats?.totalWords || 0) / 1000000).toFixed(1)}M
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#888' }}>
                                words indexed
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={6} md={3}>
                    <Card sx={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <ChaptersIcon sx={{ color: '#a855f7', fontSize: 32, mb: 1 }} />
                            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold' }}>
                                {(stats?.totalChapters || 0).toLocaleString()}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#888' }}>
                                chapters indexed
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={6} md={3}>
                    <Card sx={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <StorageIcon sx={{ color: '#f59e0b', fontSize: 32, mb: 1 }} />
                            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold' }}>
                                {stats?.percentIndexed || 0}%
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#888' }}>
                                coverage
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Indexing Progress */}
            {indexing && (
                <Alert
                    severity="info"
                    icon={<CircularProgress size={20} />}
                    sx={{ mb: 3 }}
                >
                    Indexing in progress... This runs in the background. You can navigate away.
                </Alert>
            )}

            {/* Action Buttons */}
            <Paper sx={{ p: 2, mb: 3, backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Button
                        variant="contained"
                        startIcon={indexing ? <CircularProgress size={16} color="inherit" /> : <IndexIcon />}
                        onClick={() => setConfirmDialog({
                            open: true,
                            action: () => handleIndexAll(false),
                            message: 'This will index all books that haven\'t been indexed yet. Continue?'
                        })}
                        disabled={indexing}
                        sx={{ backgroundColor: '#e50914' }}
                    >
                        {indexing ? 'Indexing...' : 'Index New Books'}
                    </Button>

                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={() => setConfirmDialog({
                            open: true,
                            action: () => handleIndexAll(true),
                            message: 'This will re-index ALL books, which may take a long time. Continue?'
                        })}
                        disabled={indexing}
                        sx={{ borderColor: '#888', color: '#888', '&:hover': { borderColor: '#fff', color: '#fff' } }}
                    >
                        Re-index All
                    </Button>

                    <Typography variant="body2" sx={{ color: '#666', ml: 'auto' }}>
                        Only EPUB files can be indexed for full-text search
                    </Typography>
                </Box>
            </Paper>

            {/* Books Table */}
            <Paper sx={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Box
                    sx={{
                        p: 2,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                    }}
                    onClick={() => setExpandedSection(!expandedSection)}
                >
                    <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 'bold' }}>
                        Books Index Status
                    </Typography>
                    <IconButton size="small" sx={{ color: '#888' }}>
                        {expandedSection ? <CollapseIcon /> : <ExpandIcon />}
                    </IconButton>
                </Box>

                <Collapse in={expandedSection}>
                    {/* Filter */}
                    <Box sx={{ px: 2, pb: 2 }}>
                        <TextField
                            size="small"
                            placeholder="Filter by title or author..."
                            value={filter}
                            onChange={(e) => { setFilter(e.target.value); setPage(0); }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ color: '#666' }} />
                                    </InputAdornment>
                                ),
                                sx: { color: '#fff', backgroundColor: '#252525' },
                            }}
                            sx={{ width: 300 }}
                        />
                    </Box>

                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ color: '#888', borderColor: 'rgba(255,255,255,0.1)' }}>Status</TableCell>
                                    <TableCell sx={{ color: '#888', borderColor: 'rgba(255,255,255,0.1)' }}>Title</TableCell>
                                    <TableCell sx={{ color: '#888', borderColor: 'rgba(255,255,255,0.1)' }}>Author</TableCell>
                                    <TableCell sx={{ color: '#888', borderColor: 'rgba(255,255,255,0.1)' }} align="right">Words</TableCell>
                                    <TableCell sx={{ color: '#888', borderColor: 'rgba(255,255,255,0.1)' }} align="right">Chapters</TableCell>
                                    <TableCell sx={{ color: '#888', borderColor: 'rgba(255,255,255,0.1)' }} align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedBooks.map((book) => (
                                    <TableRow key={book.id} hover>
                                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                                            <Tooltip title={book.error_message || book.index_status}>
                                                <Chip
                                                    icon={getStatusIcon(book.index_status)}
                                                    label={book.index_status || 'Not indexed'}
                                                    size="small"
                                                    color={getStatusColor(book.index_status)}
                                                    variant="outlined"
                                                    sx={{ borderColor: 'transparent' }}
                                                />
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.05)' }}>
                                            {book.title}
                                        </TableCell>
                                        <TableCell sx={{ color: '#888', borderColor: 'rgba(255,255,255,0.05)' }}>
                                            {book.author || '-'}
                                        </TableCell>
                                        <TableCell sx={{ color: '#888', borderColor: 'rgba(255,255,255,0.05)' }} align="right">
                                            {book.word_count?.toLocaleString() || '-'}
                                        </TableCell>
                                        <TableCell sx={{ color: '#888', borderColor: 'rgba(255,255,255,0.05)' }} align="right">
                                            {book.chapter_count || '-'}
                                        </TableCell>
                                        <TableCell sx={{ borderColor: 'rgba(255,255,255,0.05)' }} align="right">
                                            {book.index_status === 'indexed' ? (
                                                <Tooltip title="Remove from index">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleRemoveFromIndex(book.id)}
                                                        sx={{ color: '#888', '&:hover': { color: '#ef4444' } }}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            ) : (
                                                <Tooltip title="Index this book">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleIndexBook(book.id)}
                                                        sx={{ color: '#888', '&:hover': { color: '#22c55e' } }}
                                                    >
                                                        <IndexIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}

                                {paginatedBooks.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} sx={{ textAlign: 'center', color: '#666', py: 4 }}>
                                            {filter ? 'No books match your filter' : 'No books found'}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <TablePagination
                        component="div"
                        count={filteredBooks.length}
                        page={page}
                        onPageChange={(e, newPage) => setPage(newPage)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                        rowsPerPageOptions={[10, 25, 50, 100]}
                        sx={{ color: '#888', borderTop: '1px solid rgba(255,255,255,0.1)' }}
                    />
                </Collapse>
            </Paper>

            {/* Confirmation Dialog */}
            <Dialog
                open={confirmDialog.open}
                onClose={() => setConfirmDialog({ open: false })}
                PaperProps={{ sx: { backgroundColor: '#1a1a1a', color: '#fff' } }}
            >
                <DialogTitle>Confirm Action</DialogTitle>
                <DialogContent>
                    <Typography>{confirmDialog.message}</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDialog({ open: false })} sx={{ color: '#888' }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={confirmDialog.action}
                        variant="contained"
                        sx={{ backgroundColor: '#e50914' }}
                    >
                        Continue
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
            >
                <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default SearchIndexAdmin;