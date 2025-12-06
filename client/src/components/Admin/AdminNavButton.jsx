import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton, Tooltip } from '@mui/material';
import { AdminPanelSettings as AdminIcon } from '@mui/icons-material';
import { isAdmin } from '../../utils/auth';

/**
 * Admin Navigation Button
 * 
 * Drop this component into your existing navbar/header.
 * It only renders for admin users.
 * 
 * Usage:
 *   import AdminNavButton from './components/Admin/AdminNavButton';
 *   
 *   // In your navbar:
 *   <AdminNavButton />
 */
const AdminNavButton = ({ sx = {} }) => {
  const navigate = useNavigate();
  
  // Only render for admin users
  if (!isAdmin()) {
    return null;
  }

  return (
    <Tooltip title="Admin Dashboard">
      <IconButton 
        color="inherit" 
        onClick={() => navigate('/admin')}
        sx={sx}
      >
        <AdminIcon />
      </IconButton>
    </Tooltip>
  );
};

export default AdminNavButton;
