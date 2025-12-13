import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  People as UsersIcon,
  AdminPanelSettings as AdminIcon,
  Person as UserIcon,
} from '@mui/icons-material';
import { adminAPI } from '../../services/api';
import { getCurrentUserId } from '../../utils/auth';

const UserManagementPanel = ({ defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null });
  const [actionLoading, setActionLoading] = useState(null);

  const currentUserId = getCurrentUserId();

  useEffect(() => {
    if (expanded) {
      loadUsers();
    }
  }, [expanded]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminAPI.getAllUsers();
      setUsers(response.data.users || []);
    } catch (err) {
      setError('Failed to load users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (user) => {
    setDeleteDialog({ open: true, user });
  };

  const handleDeleteConfirm = async () => {
    const userId = deleteDialog.user?.id;
    if (!userId) return;

    setActionLoading(userId);
    try {
      await adminAPI.deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      setDeleteDialog({ open: false, user: null });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleRole = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    setActionLoading(user.id);
    try {
      await adminAPI.updateUserRole(user.id, newRole);
      setUsers(users.map(u => 
        u.id === user.id ? { ...u, role: newRole } : u
      ));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user role');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card sx={{ backgroundColor: '#1a1a1a', mb: 3 }}>
      <CardContent sx={{ pb: expanded ? 2 : '16px !important' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
          onClick={() => setExpanded(!expanded)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <UsersIcon color="primary" />
            <Typography variant="h6">User Management</Typography>
            <Chip
              label={users.length || '...'}
              size="small"
              sx={{ ml: 1, backgroundColor: '#333' }}
            />
          </Box>
          <IconButton size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        <Collapse in={expanded}>
          <Box sx={{ mt: 2 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer component={Paper} sx={{ backgroundColor: '#0f0f0f' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Username</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Role</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Created</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Last Login</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow
                        key={user.id}
                        sx={{
                          '&:hover': { backgroundColor: 'rgba(229, 9, 20, 0.05)' },
                          opacity: actionLoading === user.id ? 0.5 : 1,
                        }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {user.role === 'admin' ? (
                              <AdminIcon fontSize="small" sx={{ color: '#e50914' }} />
                            ) : (
                              <UserIcon fontSize="small" sx={{ color: '#666' }} />
                            )}
                            {user.username}
                            {user.id === currentUserId && (
                              <Chip label="You" size="small" sx={{ ml: 1, height: 20 }} />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ color: '#aaa' }}>{user.email}</TableCell>
                        <TableCell>
                          <Chip
                            label={user.role}
                            size="small"
                            color={user.role === 'admin' ? 'error' : 'default'}
                            onClick={() => {
                              if (user.id !== currentUserId) {
                                handleToggleRole(user);
                              }
                            }}
                            sx={{
                              cursor: user.id === currentUserId ? 'default' : 'pointer',
                              textTransform: 'capitalize',
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: '#aaa' }}>
                          {formatDate(user.created_at)}
                        </TableCell>
                        <TableCell sx={{ color: '#aaa' }}>
                          {formatDate(user.last_login)}
                        </TableCell>
                        <TableCell align="right">
                          {user.id === currentUserId ? (
                            <Tooltip title="Cannot delete yourself">
                              <span>
                                <IconButton size="small" disabled>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Delete user">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteClick(user)}
                                sx={{ color: '#f44336' }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#666' }}>
                          No users found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Collapse>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, user: null })}
        PaperProps={{ sx: { backgroundColor: '#1a1a1a' } }}
      >
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete user <strong>{deleteDialog.user?.username}</strong>?
            This will remove their account and all their reading progress. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, user: null })}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={actionLoading === deleteDialog.user?.id}
          >
            {actionLoading === deleteDialog.user?.id ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default UserManagementPanel;
