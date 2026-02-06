/**
 * Collections Page Component
 *
 * Displays user's reading lists/collections with ability to:
 * - View all collections
 * - Create new collections
 * - Add/remove books from collections
 * - Manage collection settings
 */

import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    CardMedia,
    CardActionArea,
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Chip,
    Menu,
    MenuItem,
    Snackbar,
    Alert,
    Skeleton,
    Fab,
    Tooltip,
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    ListItemSecondaryAction,
    Paper,
    InputAdornment,
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    MoreVert as MoreVertIcon,
    Bookmark as BookmarkIcon,
    BookmarkBorder as BookmarkBorderIcon,
    Favorite as FavoriteIcon,
    CheckCircle as CheckCircleIcon,
    MenuBook as MenuBookIcon,
    ArrowBack as BackIcon,
    Search as SearchIcon,
    ColorLens as ColorLensIcon,
    DragIndicator as DragIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { collectionsAPI, booksAPI } from '../../services/api';

// Predefined colors for collections
const COLLECTION_COLORS = [
    '#3b82f6', // blue
    '#22c55e', // green
    '#ef4444', // red
    '#a855f7', // purple
    '#f59e0b', // amber
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#6366f1', // indigo
    '#84cc16', // lime
    '#f97316', // orange
];

// Icon mapping
const ICONS = {
    bookmark: BookmarkIcon,
    'bookmark-border': BookmarkBorderIcon,
    favorite: FavoriteIcon,
    heart: FavoriteIcon,
    'check-circle': CheckCircleIcon,
    'book-open': MenuBookIcon,
};

const CollectionsPage = () => {
    const navigate = useNavigate();
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCollection, setSelectedCollection] = useState(null);
    const [collectionBooks, setCollectionBooks] = useState([]);
    const [loadingBooks, setLoadingBooks] = useState(false);

    // Dialog states
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    // Form states
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        color: '#6366f1',
        icon: 'bookmark'
    });

    // Menu states
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [menuCollection, setMenuCollection] = useState(null);

    // Snackbar
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Load collections on mount
    useEffect(() => {
        loadCollections();
    }, []);

    // Load collection books when selected
    useEffect(() => {
        if (selectedCollection) {
            loadCollectionBooks(selectedCollection.id);
        }
    }, [selectedCollection]);

    const loadCollections = async () => {
        try {
            setLoading(true);
            const response = await collectionsAPI.getAll();
            setCollections(response.data.collections || []);

            // Select first collection if none selected
            if (!selectedCollection && response.data.collections?.length > 0) {
                setSelectedCollection(response.data.collections[0]);
            }
        } catch (error) {
            console.error('Error loading collections:', error);

            // Initialize default collections if none exist
            if (error.response?.status === 404 || !collections.length) {
                try {
                    await collectionsAPI.initDefaults();
                    const response = await collectionsAPI.getAll();
                    setCollections(response.data.collections || []);
                    if (response.data.collections?.length > 0) {
                        setSelectedCollection(response.data.collections[0]);
                    }
                } catch (initError) {
                    showSnackbar('Failed to initialize collections', 'error');
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const loadCollectionBooks = async (collectionId) => {
        try {
            setLoadingBooks(true);
            const response = await collectionsAPI.getById(collectionId);
            setCollectionBooks(response.data.collection?.books || []);
        } catch (error) {
            console.error('Error loading collection books:', error);
            setCollectionBooks([]);
        } finally {
            setLoadingBooks(false);
        }
    };

    const handleCreateCollection = async () => {
        try {
            const response = await collectionsAPI.create(formData);
            setCollections([...collections, response.data.collection]);
            setCreateDialogOpen(false);
            resetForm();
            showSnackbar('Collection created!');
        } catch (error) {
            showSnackbar(error.response?.data?.error || 'Failed to create collection', 'error');
        }
    };

    const handleUpdateCollection = async () => {
        try {
            await collectionsAPI.update(menuCollection.id, formData);
            setCollections(collections.map(c =>
                c.id === menuCollection.id ? { ...c, ...formData } : c
            ));
            if (selectedCollection?.id === menuCollection.id) {
                setSelectedCollection({ ...selectedCollection, ...formData });
            }
            setEditDialogOpen(false);
            resetForm();
            showSnackbar('Collection updated!');
        } catch (error) {
            showSnackbar(error.response?.data?.error || 'Failed to update collection', 'error');
        }
    };

    const handleDeleteCollection = async () => {
        try {
            await collectionsAPI.delete(menuCollection.id);
            setCollections(collections.filter(c => c.id !== menuCollection.id));
            if (selectedCollection?.id === menuCollection.id) {
                setSelectedCollection(collections.find(c => c.id !== menuCollection.id) || null);
            }
            setDeleteDialogOpen(false);
            showSnackbar('Collection deleted!');
        } catch (error) {
            showSnackbar(error.response?.data?.error || 'Failed to delete collection', 'error');
        }
    };

    const handleRemoveBook = async (bookId) => {
        try {
            await collectionsAPI.removeBook(selectedCollection.id, bookId);
            setCollectionBooks(collectionBooks.filter(b => b.id !== bookId));

            // Update book count
            setCollections(collections.map(c =>
                c.id === selectedCollection.id ? { ...c, book_count: c.book_count - 1 } : c
            ));

            showSnackbar('Book removed from collection');
        } catch (error) {
            showSnackbar('Failed to remove book', 'error');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            color: '#6366f1',
            icon: 'bookmark'
        });
    };

    const openEditDialog = (collection) => {
        setMenuCollection(collection);
        setFormData({
            name: collection.name,
            description: collection.description || '',
            color: collection.color,
            icon: collection.icon
        });
        setEditDialogOpen(true);
        setMenuAnchor(null);
    };

    const openDeleteDialog = (collection) => {
        setMenuCollection(collection);
        setDeleteDialogOpen(true);
        setMenuAnchor(null);
    };

    const showSnackbar = (message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    };

    const getIcon = (iconName) => {
        const IconComponent = ICONS[iconName] || BookmarkIcon;
        return IconComponent;
    };

    if (loading) {
        return (
            <Box sx={{ p: 3 }}>
                <Skeleton variant="text" width={200} height={40} />
                <Grid container spacing={2} sx={{ mt: 2 }}>
                    {[1, 2, 3, 4].map(i => (
                        <Grid item xs={12} sm={6} md={3} key={i}>
                            <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
                        </Grid>
                    ))}
                </Grid>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3, backgroundColor: '#141414', minHeight: '100vh' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <IconButton edge="start" color="inherit" onClick={() => navigate('/')}>
                    <BackIcon />
                </IconButton>
                <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold' }}>
                    My Collections
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateDialogOpen(true)}
                    sx={{ backgroundColor: '#e50914', '&:hover': { backgroundColor: '#f40612' } }}
                >
                    New Collection
                </Button>
            </Box>

            <Grid container spacing={3}>
                {/* Collections Sidebar */}
                <Grid item xs={12} md={3}>
                    <Paper sx={{ backgroundColor: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                        <List sx={{ p: 0 }}>
                            {collections.map((collection) => {
                                const IconComponent = getIcon(collection.icon);
                                const isSelected = selectedCollection?.id === collection.id;

                                return (
                                    <ListItem
                                        key={collection.id}
                                        button
                                        selected={isSelected}
                                        onClick={() => setSelectedCollection(collection)}
                                        sx={{
                                            borderLeft: isSelected ? `4px solid ${collection.color}` : '4px solid transparent',
                                            '&.Mui-selected': {
                                                backgroundColor: 'rgba(255,255,255,0.05)',
                                            },
                                            '&:hover': {
                                                backgroundColor: 'rgba(255,255,255,0.08)',
                                            }
                                        }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 40 }}>
                                            <IconComponent sx={{ color: collection.color }} />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={collection.name}
                                            secondary={`${collection.book_count || 0} books`}
                                            primaryTypographyProps={{ color: '#fff', fontWeight: isSelected ? 600 : 400 }}
                                            secondaryTypographyProps={{ color: '#888' }}
                                        />
                                        <ListItemSecondaryAction>
                                            <IconButton
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setMenuAnchor(e.currentTarget);
                                                    setMenuCollection(collection);
                                                }}
                                                sx={{ color: '#888' }}
                                            >
                                                <MoreVertIcon fontSize="small" />
                                            </IconButton>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                );
                            })}
                        </List>
                    </Paper>
                </Grid>

                {/* Collection Content */}
                <Grid item xs={12} md={9}>
                    {selectedCollection ? (
                        <Box>
                            {/* Collection Header */}
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="h5" sx={{ color: '#fff', mb: 1 }}>
                                    {selectedCollection.name}
                                </Typography>
                                {selectedCollection.description && (
                                    <Typography sx={{ color: '#888' }}>
                                        {selectedCollection.description}
                                    </Typography>
                                )}
                            </Box>

                            {/* Books Grid */}
                            {loadingBooks ? (
                                <Grid container spacing={2}>
                                    {[1, 2, 3, 4, 5, 6].map(i => (
                                        <Grid item xs={6} sm={4} md={3} lg={2} key={i}>
                                            <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1 }} />
                                        </Grid>
                                    ))}
                                </Grid>
                            ) : collectionBooks.length === 0 ? (
                                <Paper
                                    sx={{
                                        p: 4,
                                        textAlign: 'center',
                                        backgroundColor: '#1a1a1a',
                                        borderRadius: 2,
                                    }}
                                >
                                    <BookmarkBorderIcon sx={{ fontSize: 60, color: '#444', mb: 2 }} />
                                    <Typography variant="h6" sx={{ color: '#888', mb: 1 }}>
                                        No books in this collection
                                    </Typography>
                                    <Typography sx={{ color: '#666', mb: 2 }}>
                                        Add books from the library to this collection
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        onClick={() => navigate('/dashboard')}
                                        sx={{ borderColor: '#e50914', color: '#e50914' }}
                                    >
                                        Browse Library
                                    </Button>
                                </Paper>
                            ) : (
                                <Grid container spacing={2}>
                                    {collectionBooks.map((book) => (
                                        <Grid item xs={6} sm={4} md={3} lg={2} key={book.id}>
                                            <Card
                                                sx={{
                                                    backgroundColor: '#1a1a1a',
                                                    borderRadius: 1,
                                                    position: 'relative',
                                                    '&:hover .remove-btn': {
                                                        opacity: 1,
                                                    }
                                                }}
                                            >
                                                <CardActionArea onClick={() => navigate(`/book/${book.id}`)}>
                                                    <CardMedia
                                                        component="img"
                                                        height="200"
                                                        image={booksAPI.getCoverUrl(book.id)}
                                                        alt={book.title}
                                                        sx={{ objectFit: 'cover' }}
                                                        onError={(e) => {
                                                            e.target.src = '/placeholder-cover.png';
                                                        }}
                                                    />
                                                    <CardContent sx={{ p: 1.5 }}>
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                color: '#fff',
                                                                fontWeight: 500,
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap'
                                                            }}
                                                        >
                                                            {book.title}
                                                        </Typography>
                                                        <Typography
                                                            variant="caption"
                                                            sx={{ color: '#888' }}
                                                        >
                                                            {book.author}
                                                        </Typography>
                                                    </CardContent>
                                                </CardActionArea>

                                                {/* Remove button */}
                                                <IconButton
                                                    className="remove-btn"
                                                    size="small"
                                                    onClick={() => handleRemoveBook(book.id)}
                                                    sx={{
                                                        position: 'absolute',
                                                        top: 8,
                                                        right: 8,
                                                        backgroundColor: 'rgba(0,0,0,0.7)',
                                                        opacity: 0,
                                                        transition: 'opacity 0.2s',
                                                        '&:hover': {
                                                            backgroundColor: '#e50914',
                                                        }
                                                    }}
                                                >
                                                    <DeleteIcon fontSize="small" sx={{ color: '#fff' }} />
                                                </IconButton>
                                            </Card>
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </Box>
                    ) : (
                        <Paper
                            sx={{
                                p: 4,
                                textAlign: 'center',
                                backgroundColor: '#1a1a1a',
                                borderRadius: 2,
                            }}
                        >
                            <Typography sx={{ color: '#888' }}>
                                Select a collection to view its books
                            </Typography>
                        </Paper>
                    )}
                </Grid>
            </Grid>

            {/* Collection Menu */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                PaperProps={{
                    sx: { backgroundColor: '#2a2a2a', color: '#fff' }
                }}
            >
                <MenuItem onClick={() => openEditDialog(menuCollection)}>
                    <EditIcon sx={{ mr: 1 }} fontSize="small" /> Edit
                </MenuItem>
                {!menuCollection?.is_default && (
                    <MenuItem onClick={() => openDeleteDialog(menuCollection)} sx={{ color: '#ef4444' }}>
                        <DeleteIcon sx={{ mr: 1 }} fontSize="small" /> Delete
                    </MenuItem>
                )}
            </Menu>

            {/* Create Collection Dialog */}
            <Dialog
                open={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                PaperProps={{ sx: { backgroundColor: '#1a1a1a', color: '#fff', minWidth: 400 } }}
            >
                <DialogTitle>Create Collection</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        sx={{ mt: 1, mb: 2 }}
                        InputProps={{ sx: { color: '#fff' } }}
                        InputLabelProps={{ sx: { color: '#888' } }}
                    />
                    <TextField
                        fullWidth
                        label="Description (optional)"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        multiline
                        rows={2}
                        sx={{ mb: 2 }}
                        InputProps={{ sx: { color: '#fff' } }}
                        InputLabelProps={{ sx: { color: '#888' } }}
                    />
                    <Typography variant="body2" sx={{ color: '#888', mb: 1 }}>Color</Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                        {COLLECTION_COLORS.map((color) => (
                            <Box
                                key={color}
                                onClick={() => setFormData({ ...formData, color })}
                                sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    backgroundColor: color,
                                    cursor: 'pointer',
                                    border: formData.color === color ? '3px solid #fff' : '3px solid transparent',
                                    transition: 'border 0.2s'
                                }}
                            />
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)} sx={{ color: '#888' }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateCollection}
                        variant="contained"
                        disabled={!formData.name.trim()}
                        sx={{ backgroundColor: '#e50914' }}
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Collection Dialog */}
            <Dialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                PaperProps={{ sx: { backgroundColor: '#1a1a1a', color: '#fff', minWidth: 400 } }}
            >
                <DialogTitle>Edit Collection</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        sx={{ mt: 1, mb: 2 }}
                        InputProps={{ sx: { color: '#fff' } }}
                        InputLabelProps={{ sx: { color: '#888' } }}
                    />
                    <TextField
                        fullWidth
                        label="Description (optional)"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        multiline
                        rows={2}
                        sx={{ mb: 2 }}
                        InputProps={{ sx: { color: '#fff' } }}
                        InputLabelProps={{ sx: { color: '#888' } }}
                    />
                    <Typography variant="body2" sx={{ color: '#888', mb: 1 }}>Color</Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {COLLECTION_COLORS.map((color) => (
                            <Box
                                key={color}
                                onClick={() => setFormData({ ...formData, color })}
                                sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    backgroundColor: color,
                                    cursor: 'pointer',
                                    border: formData.color === color ? '3px solid #fff' : '3px solid transparent',
                                    transition: 'border 0.2s'
                                }}
                            />
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialogOpen(false)} sx={{ color: '#888' }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUpdateCollection}
                        variant="contained"
                        disabled={!formData.name.trim()}
                        sx={{ backgroundColor: '#e50914' }}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                PaperProps={{ sx: { backgroundColor: '#1a1a1a', color: '#fff' } }}
            >
                <DialogTitle>Delete Collection?</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete "{menuCollection?.name}"?
                        This will not delete the books, only remove them from this collection.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)} sx={{ color: '#888' }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteCollection}
                        variant="contained"
                        sx={{ backgroundColor: '#e50914' }}
                    >
                        Delete
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

export default CollectionsPage;
