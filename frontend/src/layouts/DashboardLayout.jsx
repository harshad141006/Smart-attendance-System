import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import {
  Dashboard,
  Logout,
  Settings,
  People,
  Assignment,
  BarChart,
  Videocam,
} from '@mui/icons-material';
import { useAuth } from '../hooks';

const DRAWER_WIDTH = 240;

const menuItems = {
  student: [
    { label: 'Dashboard', path: '/student/dashboard', icon: Dashboard },
    { label: 'Register Face', path: '/student/register-face', icon: Assignment },
    { label: 'Mark Attendance', path: '/student/attendance', icon: Assignment },
    { label: 'Video Face Verification', path: '/student/face-detect-video', icon: Videocam },
    { label: 'Attendance History', path: '/student/history', icon: BarChart },
    { label: 'Profile', path: '/student/profile', icon: Settings },
  ],
  faculty: [
    { label: 'Dashboard', path: '/faculty/dashboard', icon: Dashboard },
    { label: 'Create Session', path: '/faculty/create-session', icon: Assignment },
    { label: 'Live Attendance', path: '/faculty/live-attendance', icon: People },
    { label: 'Reports', path: '/faculty/reports', icon: BarChart },
  ],
  advisor: [
    { label: 'Dashboard', path: '/advisor/dashboard', icon: Dashboard },
    { label: 'Student Analytics', path: '/advisor/analytics', icon: BarChart },
    { label: 'Shortage Reports', path: '/advisor/shortage-reports', icon: Assignment },
  ],
  admin: [
    { label: 'Dashboard', path: '/admin/dashboard', icon: Dashboard },
    { label: 'Manage Users', path: '/admin/manage-users', icon: People },
    { label: 'Manage Subjects', path: '/admin/manage-subjects', icon: Assignment },
    { label: 'Reports', path: '/admin/reports', icon: BarChart },
  ],
};

const DashboardLayout = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleProfileMenuClose();
  };

  const items = menuItems[user?.role] || [];

  const drawerContent = (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
          {user?.first_name?.[0]}
        </Avatar>
        <Box>
          <Typography variant="subtitle2">{user?.first_name} {user?.last_name}</Typography>
          <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>{user?.role}</Typography>
        </Box>
      </Box>

      <List>
        {items.map((item) => (
          <ListItem
            button
            key={item.path}
            onClick={() => {
              navigate(item.path);
              setMobileOpen(false);
            }}
            sx={{ mb: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
          >
            <ListItemIcon><item.icon /></ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* AppBar */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Smart Attendance System
          </Typography>
          <Avatar
            onClick={handleProfileMenuOpen}
            sx={{ cursor: 'pointer', bgcolor: 'secondary.main' }}
          >
            {user?.first_name?.[0]}
          </Avatar>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
          >
            <MenuItem onClick={() => navigate('/student/profile')}>Profile</MenuItem>
            <MenuItem onClick={() => navigate('/student/profile')}>Settings</MenuItem>
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            mt: 8,
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Main Content */}
      <Box
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 8,
          ml: `${DRAWER_WIDTH}px`,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default DashboardLayout;
