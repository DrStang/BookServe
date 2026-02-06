import React, { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Box,
} from '@mui/material';
import {
  AccountCircle as AccountIcon,
  Lock as PasswordIcon,
  Logout as LogoutIcon,
  Email as EmailIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import ChangePasswordDialog from './ChangePasswordDialog';
import NotificationSettings from "../Common/NotificationSettings";

const SUPPORT_EMAIL = 'dandolewski@gmail.com';

const UserMenu = ({ onLogout, username }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [notificationSettingOpen, setNotificationSettingOpen] = useState(false);

  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleChangePassword = () => {
    handleClose();
    setChangePasswordOpen(true);
  };

  const handleNotificationSettings = () => {
    handleClose();
    setNotificationSettingOpen(true);
  }

  const handleContactSupport = () => {
    handleClose();
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=BookServe Support Request`;
  };

  const handleLogout = () => {
    handleClose();
    onLogout();
  };

  return (
    <>
      <IconButton
        onClick={handleClick}
        color="inherit"
        aria-controls={open ? 'user-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        sx={{
          '&:hover': {
            backgroundColor: 'rgba(229, 9, 20, 0.1)',
          },
        }}
      >
        <AccountIcon sx={{ fontSize: 28 }} />
      </IconButton>

      <Menu
        id="user-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          elevation: 4,
          sx: {
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            minWidth: 200,
            mt: 1,
            '& .MuiMenuItem-root': {
              py: 1.5,
              '&:hover': {
                backgroundColor: 'rgba(229, 9, 20, 0.1)',
              },
            },
          },
        }}
      >
        {username && (
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #333' }}>
            <Typography variant="body2" color="text.secondary">
              Signed in as
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {username}
            </Typography>
          </Box>
        )}

        <MenuItem onClick={handleChangePassword}>
          <ListItemIcon>
            <PasswordIcon fontSize="small" sx={{ color: '#fff' }} />
          </ListItemIcon>
          <ListItemText>Change Password</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleContactSupport}>
          <ListItemIcon>
            <EmailIcon fontSize="small" sx={{ color: '#fff' }} />
          </ListItemIcon>
          <ListItemText>Contact Support</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleNotificationSettings}>
          <ListItemIcon>
            <NotificationsIcon fontSize="small" sx={{ color: '#fff' }} />
          </ListItemIcon>
          <ListItemText>Notification Settings</ListItemText>
        </MenuItem>

        <Divider sx={{ borderColor: '#333', my: 1 }} />

        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" sx={{ color: '#e50914' }} />
          </ListItemIcon>
          <ListItemText sx={{ '& .MuiTypography-root': { color: '#e50914' } }}>
            Log Out
          </ListItemText>
        </MenuItem>
      </Menu>

      <ChangePasswordDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
      <NotificationSettings
          open={notificationSettingOpen}
          onClose={() => setNotificationSettingOpen(false)}
      />
    </>
  );
};

export default UserMenu;
