/**
 * Full-Text Search Page Component
 *
 * Allows users to search inside book contents:
 * - Search across all books
 * - Search within a specific book
 * - View highlighted snippets
 * - Jump to results in the reader
 */

import React, { useState, useCallback } from 'react';
import {
    Box,
    Typography,
    TextField,
    InputAdornment,
    Paper,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    Avatar,
    Chip,
    CircularProgress,
    Divider,
    Button,
    IconButton,
    Tabs,
    Tab,
    Collapse,
    Alert,
    Tooltip,
} from '@mui/material';
import {
    Search as SearchIcon,
    MenuBook as BookIcon,
    Clear as ClearIcon,
    OpenInNew as OpenIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Settings as SettingsIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { debounce } from 'lodash';
import { searchAPI, booksAPI } from '../../services/api';

const FullTextSearchPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [query, setQuery] = useState(searchParams.get('q') || '');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchPerformed, setSearchPerformed] = useState(false);
    const [stats, setStats] = useState(null);
    const [expandedBook, setExpandedBook] = useState(null);
    const [error, setError] = useState(null);

    // Group results by book
    const groupedResults = React.useMemo(() => {
        const groups = {};
        results.forEach(result => {
            const bookId = result.bookId;
            if (!groups[bookId]) {
                groups[bookId] = {
                    bookId,
                    bookTitle: result.bookTitle,
                    bookAuthor: result.bookAuthor,
                    coverImage: result.coverImage,
                    matches: []
                };
            }
            groups[bookId].matches.push(result);
        });
        return Object.values(groups);
    }, [results]);

    // Load stats on mount
    React.useEffect(() => {
        loadStats();

        // Perform initial search if query in URL
        if (searchParams.get('q')) {
            performSearch(searchParams.get('q'));
        }
    }, []);

    const loadStats = async () => {
        try {
            const response = await searchAPI.getStats();
            setStats(response.data);
        } catch (err) {
            console.error('Error loading search stats:', err);
        }
    };

    const performSearch = async (searchQuery) => {
        if (!searchQuery || searchQuery.trim().length < 2) {
            setResults([]);
            setSearchPerformed(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            setSearchPerformed(true);

            const response = await searchAPI.search(searchQuery.trim());
            setResults(response.data.results || []);

            // Update URL
            setSearchParams({ q: searchQuery.trim() });
        } catch (err) {
            console.error('Search error:', err);
            setError(err.response?.data?.error || 'Search failed. Please try again.');
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    // Debounced search
    const debouncedSearch = useCallback(
        debounce((value) => performSearch(value), 500),
        []
    );

    const handleQueryChange = (e) => {
        const value = e.target.value;
        setQuery(value);
        debouncedSearch(value);
    };

    const handleClear = () => {
        setQuery('');
        setResults([]);
        setSearchPerformed(false);
        setSearchParams({});
    };

    const handleBookClick = (bookId) => {
        navigate(`/book/${bookId}`);
    };

    const handleReadBook = (bookId, chapterTitle) => {
        // Navigate to reader, potentially with search term highlighted
        navigate(`/read/${bookId}?search=${encodeURIComponent(query)}`);
    };

    // Render highlighted snippet
    const renderSnippet = (snippet) => {
        // The snippet contains <mark> tags from the server
        return (
            <Typography
                variant="body2"
                component="div"
                sx={{
                    color: '#aaa',
                    '& mark': {
                        backgroundColor: '#e50914',
                        color: '#fff',
                        padding: '0 2px',
                        borderRadius: '2px',
                    }
                }}
                dangerouslySetInnerHTML={{ __html: snippet }}
            />
        );
    };

    return (
        <Box sx={{ p: 3, backgroundColor: '#141414', minHeight: '100vh' }}>
            {/* Header */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold', mb: 1 }}>
                    Search Inside Books
                </Typography>
                <Typography sx={{ color: '#888' }}>
                    Search through the full text of your books
                </Typography>
            </Box>

            {/* Search Box */}
            <Paper
                elevation={0}
                sx={{
                    p: 2,
                    mb: 3,
                    backgroundColor: '#1a1a1a',
                    borderRadius: 2,
                }}
            >
                <TextField
                    fullWidth
                    placeholder="Search for words or phrases..."
                    value={query}
                    onChange={handleQueryChange}
                    autoFocus
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ color: '#888' }} />
                            </InputAdornment>
                        ),
                        endAdornment: query && (
                            <InputAdornment position="end">
                                {loading ? (
                                    <CircularProgress size={20} sx={{ color: '#888' }} />
                                ) : (
                                    <IconButton size="small" onClick={handleClear}>
                                        <ClearIcon sx={{ color: '#888' }} />
                                    </IconButton>
                                )}
                            </InputAdornment>
                        ),
                        sx: {
                            color: '#fff',
                            backgroundColor: '#252525',
                            borderRadius: 1,
                            '& fieldset': { border: 'none' },
                        }
                    }}
                />

                {/* Stats */}
                {stats && (
                    <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <Chip
                            size="small"
                            label={`${stats.indexedBooks} of ${stats.totalBooks} books indexed`}
                            sx={{ backgroundColor: '#252525', color: '#888' }}
                        />
                        <Chip
                            size="small"
                            label={`${(stats.totalWords || 0).toLocaleString()} words searchable`}
                            sx={{ backgroundColor: '#252525', color: '#888' }}
                        />
                        {stats.isIndexing && (
                            <Chip
                                size="small"
                                label="Indexing in progress..."
                                color="warning"
                                icon={<CircularProgress size={12} />}
                            />
                        )}
                    </Box>
                )}
            </Paper>

            {/* Error */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {/* Results */}
            {searchPerformed && !loading && (
                <Box>
                    {/* Results Header */}
                    <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography sx={{ color: '#888' }}>
                            {results.length === 0
                                ? 'No results found'
                                : `Found ${results.length} matches in ${groupedResults.length} books`}
                        </Typography>
                    </Box>

                    {/* Grouped Results */}
                    {groupedResults.map((group) => (
                        <Paper
                            key={group.bookId}
                            sx={{
                                mb: 2,
                                backgroundColor: '#1a1a1a',
                                borderRadius: 2,
                                overflow: 'hidden',
                            }}
                        >
                            {/* Book Header */}
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    p: 2,
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
                                }}
                                onClick={() => setExpandedBook(expandedBook === group.bookId ? null : group.bookId)}
                            >
                                <Avatar
                                    variant="rounded"
                                    src={group.coverImage}
                                    sx={{ width: 50, height: 70, mr: 2 }}
                                >
                                    <BookIcon />
                                </Avatar>

                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 500 }}>
                                        {group.bookTitle}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#888' }}>
                                        {group.bookAuthor}
                                    </Typography>
                                    <Chip
                                        size="small"
                                        label={`${group.matches.length} match${group.matches.length !== 1 ? 'es' : ''}`}
                                        sx={{ mt: 1, backgroundColor: '#e50914', color: '#fff' }}
                                    />
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Tooltip title="Open book">
                                        <IconButton
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleBookClick(group.bookId);
                                            }}
                                            sx={{ color: '#888' }}
                                        >
                                            <OpenIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    {expandedBook === group.bookId ? (
                                        <ExpandLessIcon sx={{ color: '#888' }} />
                                    ) : (
                                        <ExpandMoreIcon sx={{ color: '#888' }} />
                                    )}
                                </Box>
                            </Box>

                            {/* Matches List */}
                            <Collapse in={expandedBook === group.bookId}>
                                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                                <List sx={{ p: 0 }}>
                                    {group.matches.map((match, index) => (
                                        <React.Fragment key={index}>
                                            <ListItem
                                                button
                                                onClick={() => handleReadBook(group.bookId, match.chapterTitle)}
                                                sx={{
                                                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
                                                }}
                                            >
                                                <ListItemText
                                                    primary={
                                                        <Typography variant="body2" sx={{ color: '#e50914', mb: 0.5 }}>
                                                            {match.chapterTitle}
                                                        </Typography>
                                                    }
                                                    secondary={renderSnippet(match.snippet)}
                                                />
                                            </ListItem>
                                            {index < group.matches.length - 1 && (
                                                <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
                                            )}
                                        </React.Fragment>
                                    ))}
                                </List>
                            </Collapse>
                        </Paper>
                    ))}

                    {/* Empty State */}
                    {results.length === 0 && !loading && query.length >= 2 && (
                        <Paper
                            sx={{
                                p: 4,
                                textAlign: 'center',
                                backgroundColor: '#1a1a1a',
                                borderRadius: 2,
                            }}
                        >
                            <SearchIcon sx={{ fontSize: 60, color: '#444', mb: 2 }} />
                            <Typography variant="h6" sx={{ color: '#888', mb: 1 }}>
                                No matches found for "{query}"
                            </Typography>
                            <Typography sx={{ color: '#666', mb: 2 }}>
                                Try different keywords or check if the book has been indexed
                            </Typography>
                            <Button
                                variant="outlined"
                                onClick={() => navigate('/dashboard')}
                                sx={{ borderColor: '#e50914', color: '#e50914' }}
                            >
                                Browse Library
                            </Button>
                        </Paper>
                    )}
                </Box>
            )}

            {/* Initial State */}
            {!searchPerformed && !loading && (
                <Paper
                    sx={{
                        p: 4,
                        textAlign: 'center',
                        backgroundColor: '#1a1a1a',
                        borderRadius: 2,
                    }}
                >
                    <SearchIcon sx={{ fontSize: 60, color: '#444', mb: 2 }} />
                    <Typography variant="h6" sx={{ color: '#888', mb: 1 }}>
                        Search Inside Your Books
                    </Typography>
                    <Typography sx={{ color: '#666' }}>
                        Enter at least 2 characters to search through book contents
                    </Typography>
                </Paper>
            )}

            {/* Loading State */}
            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress sx={{ color: '#e50914' }} />
                </Box>
            )}
        </Box>
    );
};

export default FullTextSearchPage;