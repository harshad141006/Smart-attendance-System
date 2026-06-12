import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, List, ListItem, ListItemText, Divider, Button, Alert, CircularProgress, Badge, IconButton } from '@mui/material';
import { notificationService } from '../../services';
import { Drafts, Mail } from '@mui/icons-material';

const StudentNotifications = () => {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationService.list();
      setNotifications(res.data || []);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (notifId) => {
    try {
      await notificationService.markAsRead(notifId);
      // Update local state
      setNotifications(notifications.map(n => n.id === notifId ? { ...n, read: true } : n));
      setSuccessMsg('Notification marked as read.');
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to update notification status.');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <Box sx={{ maxWidth: '800px', margin: '0 auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, background: 'linear-gradient(to right, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Notifications
          </Typography>
          <Typography color="textSecondary" variant="subtitle1">
            Stay updated with low attendance alerts, session schedules, and OD requests.
          </Typography>
        </Box>
        <Badge badgeContent={unreadCount} color="error">
          <Mail color="primary" sx={{ fontSize: 32 }} />
        </Badge>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }} onClose={() => setSuccessMsg('')}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }} onClose={() => setErrorMsg('')}>{errorMsg}</Alert>}

      <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <CardContent sx={{ p: 0 }}>
          {notifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="textSecondary" variant="h6">
                Your inbox is clean.
              </Typography>
              <Typography color="textSecondary" variant="body2" sx={{ mt: 1 }}>
                No notifications received yet.
              </Typography>
            </Box>
          ) : (
            <List sx={{ py: 0 }}>
              {notifications.map((notif, index) => (
                <React.Fragment key={notif.id || index}>
                  <ListItem
                    sx={{
                      p: 3,
                      bgcolor: notif.read ? 'transparent' : 'rgba(102, 126, 234, 0.04)',
                      transition: 'background-color 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <Box sx={{ pr: 2 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: notif.read ? 'bold' : 800, color: notif.read ? 'text.primary' : 'primary.main', mb: 0.5 }}>
                        {notif.title}
                      </Typography>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                        {notif.message}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {new Date(notif.created_at).toLocaleString()}
                      </Typography>
                    </Box>
                    {!notif.read && (
                      <IconButton
                        color="primary"
                        onClick={() => handleMarkAsRead(notif.id)}
                        title="Mark as Read"
                      >
                        <Drafts />
                      </IconButton>
                    )}
                  </ListItem>
                  {index < notifications.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default StudentNotifications;
