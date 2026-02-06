/**
 * Add to Collection Button Component
 *
 * Dropdown menu for adding/removing a book from collections.
 * Can be used in book cards, book details page, etc.
 */

import React, { useState, useEffect } from 'react';
import {
    IconButton,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Typography,
    CircularProgress,
    Checkbox,
    Box,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Snackbar,
    Alert,
} from '@mui/material';
import {
    BookmarkAdd as AddIcon,
    Bookmark as BookmarkIcon,
    BookmarkBorder as BookmarkBorderIcon,
    Add as PlusIcon,
    Check as CheckIcon,
} from '@mui/icons-material';
import { collectionsAPI } from '../../services/api';

// Color mapping for icons
const getCollectionColor = (color) => color || '#6366f1';

const AddToCollectionButton = ({
                                   bookId,
                                   bookTitle,
                                   variant = 'icon', // 'icon' | 'button'
                                   size = 'medium',
                                   onUpdate,
                               }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const [collections, setCollections] = useState([]);
    const [bookCollections, setBookCollections] = useState([]);
    const [loading, setLoading] = useState(false);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Check if book is in any collection
    const isInAnyCollection = bookCollections.length > 0;

    // Load data when menu opens
    const handleClick = async (event) => {
        setAnchorEl(event.currentTarget);
        await loadData();
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const [collectionsRes, bookCollectionsRes] = await Promise.all([
                collectionsAPI.getAll(),
                collectionsAPI.getBookCollections(bookId),
            ]);

            setCollections(collectionsRes.data.collections || []);
            setBookCollections(bookCollectionsRes.data.collections || []);
        } catch (error) {
            console.error('Error loading collections:', error);
        } finally {
            setLoading(false);
        }
    };

    const isBookInCollection = (collectionId) => {
        return bookCollections.some(c => c.id === collectionId);
    };

    const handleToggleCollection = async (collection) => {
        try {
            if (isBookInCollection(collection.id)) {
                await collectionsAPI.removeBook(collection.id, bookId);
                setBookCollections(bookCollections.filter(c => c.id !== collection.id));
                showSnackbar(`Removed from "${collection.name}"`);
            } else {
                await collectionsAPI.addBook(collection.id, bookId);
                setBookCollections([...bookCollections, collection]);
                showSnackbar(`Added to "${collection.name}"`);
            }

            if (onUpdate) onUpdate();
        } catch (error) {
            showSnackbar(error.response?.data?.error || 'Failed to update collection', 'error');
        }
    };

    const handleCreateAndAdd = async () => {
        if (!newCollectionName.trim()) return;

        try {
            const response = await collectionsAPI.create({ name: newCollectionName.trim() });
            const newCollection = response.data.collection;

            // Add book to new collection
            await collectionsAPI.addBook(newCollection.id, bookId);

            setCollections([...collections, newCollection]);
            setBookCollections([...bookCollections, newCollection]);
            setCreateDialogOpen(false);
            setNewCollectionName('');
            showSnackbar(`Added to new collection "${newCollection.name}"`);

            if (onUpdate) onUpdate();
        } catch (error) {
            showSnackbar(error.response?.data?.error || 'Failed to create collection', 'error');
        }
    };

    const showSnackbar = (message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    };

    return (
        <>
            {/* Trigger Button */}
            <Tooltip title={isInAnyCollection ? 'In collection' : 'Add to collection'}>
                <IconButton
                    onClick={handleClick}
                    size={size}
                    sx={{
                        color: isInAnyCollection ? '#e50914' : '#888',
                        '&:hover': {
                            color: '#e50914',
                            backgroundColor: 'rgba(229, 9, 20, 0.1)',
                        }
                    }}
                >
                    {isInAnyCollection ? <BookmarkIcon /> : <BookmarkBorderIcon />}
                </IconButton>
            </Tooltip>

            {/* Collections Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                PaperProps={{
                    sx: {
                        backgroundColor: '#1a1a1a',
                        color: '#fff',
                        minWidth: 250,
                        maxHeight: 400,
                    }
                }}
            >
                <Box sx={{ px: 2, py: 1 }}>
                    <Typography variant="subtitle2" sx={{ color: '#888' }}>
                        Add to Collection
                    </Typography>
                </Box>

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                        <CircularProgress size={24} sx={{ color: '#e50914' }} />
                    </Box>
                ) : (
                    <>
                        {collections.map((collection) => (
                            <MenuItem
                                key={collection.id}
                                onClick={() => handleToggleCollection(collection)}
                                sx={{
                                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' }
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    <Checkbox
                                        checked={isBookInCollection(collection.id)}
                                        sx={{
                                            color: getCollectionColor(collection.color),
                                            '&.Mui-checked': { color: getCollectionColor(collection.color) },
                                            p: 0,
                                        }}
                                    />
                                </ListItemIcon>
                                <ListItemText
                                    primary={collection.name}
                                    secondary={`${collection.book_count || 0} books`}
                                    primaryTypographyProps={{ sx: { color: '#fff' } }}
                                    secondaryTypographyProps={{ sx: { color: '#666', fontSize: '0.75rem' } }}
                                />
                            </MenuItem>
                        ))}

                        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 1 }} />

                        <MenuItem
                            onClick={() => {
                                handleClose();
                                setCreateDialogOpen(true);
                            }}
                            sx={{
                                color: '#e50914',
                                '&:hover': { backgroundColor: 'rgba(229,9,20,0.1)' }
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                                <PlusIcon sx={{ color: '#e50914' }} />
                            </ListItemIcon>
                            <ListItemText primary="Create New Collection" />
                        </MenuItem>
                    </>
                )}
            </Menu>

            {/* Create Collection Dialog */}
            <Dialog
                open={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                PaperProps={{ sx: { backgroundColor: '#1a1a1a', color: '#fff', minWidth: 350 } }}
            >
                <DialogTitle>Create New Collection</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Collection Name"
                        value={newCollectionName}
                        onChange={(e) => setNewCollectionName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleCreateAndAdd()}
                        sx={{ mt: 1 }}
                        InputProps={{ sx: { color: '#fff' } }}
                        InputLabelProps={{ sx: { color: '#888' } }}
                    />
                    <Typography variant="body2" sx={{ color: '#666', mt: 1 }}>
                        "{bookTitle}" will be added to this collection
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)} sx={{ color: '#888' }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateAndAdd}
                        variant="contained"
                        disabled={!newCollectionName.trim()}
                        sx={{ backgroundColor: '#e50914' }}
                    >
                        Create & Add
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    severity={snackbar.severity}
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
};

export default AddToCollectionButton;