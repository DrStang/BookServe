import React from 'react';
import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Box
} from '@mui/material';
import {
  AutoAwesome as AIIcon,
  Psychology as InsightsIcon,
  Chat as ChatIcon,
  Home as HomeIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const AINavMenu = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'Library', icon: <HomeIcon /> },
    { path: '/ai/insights', label: 'Reading Insights', icon: <InsightsIcon /> },
    { path: '/ai/chat', label: 'AI Chat', icon: <ChatIcon /> }
  ];

  return (
    <Box>
      <Box sx={{ p: 2 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <AIIcon color="primary" />
          <Typography variant="h6">AI Features</Typography>
        </Box>
      </Box>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              sx={{
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  '&:hover': {
                    bgcolor: 'primary.dark'
                  }
                }
              }}
            >
              <ListItemIcon sx={{ color: 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default AINavMenu;
