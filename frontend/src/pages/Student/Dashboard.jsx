import React, { useEffect, useState } from 'react';
import { Box, Grid, Card, CardContent, Typography, Button, CircularProgress, List, ListItem, ListItemText, Divider, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks';
import { studentService, notificationService } from '../../services';
import { BarChart, Person, CameraAlt, NotificationsActive } from '@mui/icons-material';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ percentage: 0, status: 'warning' });
  const [history, setHistory] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Fetch stats
        const statsRes = await studentService.getAttendancePercentage();
        const percentageValue = Number(statsRes.data.percentage) || statsRes.data.attendance_percentage || 0;
        setStats({
          percentage: percentageValue,
          status: statsRes.data.status || (percentageValue >= 75 ? 'success' : 'warning')
        });

        // Fetch recent records
        const historyRes = await studentService.getAttendanceHistory();
        setHistory((historyRes.data.records || historyRes.data.attendance_records || []).slice(0, 5));

        // Fetch notifications
        try {
          const notifRes = await notificationService.list();
          setNotifications((notifRes.data || []).slice(0, 4));
        } catch (notifErr) {
          console.error('Failed to fetch notifications:', notifErr);
          setNotifications([]);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress size={60} thickness={4} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, background: 'linear-gradient(to right, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Welcome back, {(user?.displayName || user?.name || 'Student').split(' ')[0]}!
          </Typography>
          <Typography color="textSecondary" variant="subtitle1">
            Track your classes, mark your attendance, and manage face registrations.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<CameraAlt />}
          onClick={() => navigate('/student/attendance')}
          sx={{ borderRadius: '12px', px: 3, py: 1.2, textTransform: 'none', fontWeight: 'bold', boxShadow: '0 4px 14px 0 rgba(102, 126, 234, 0.4)', backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        >
          Mark Attendance
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {/* Attendance Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)', overflow: 'visible', position: 'relative' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                Overall Attendance
              </Typography>
              <Box sx={{ position: 'relative', display: 'inline-flex', mb: 2 }}>
                <CircularProgress
                  variant="determinate"
                  value={stats.percentage}
                  size={120}
                  thickness={6}
                  color={stats.percentage >= 75 ? 'success' : 'warning'}
                />
                <Box
                  sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="h5" component="div" color="textSecondary" sx={{ fontWeight: 'bold' }}>
                    {stats.percentage.toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
              <Typography variant="body2" color={stats.percentage >= 75 ? 'success.main' : 'warning.main'} sx={{ fontWeight: 'bold', mt: 1 }}>
                {stats.percentage >= 75 ? 'Excellent! Above 75% limit' : 'Warning: Below 75% limit!'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Profile Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                Student Profile
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Person sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                <Box>
                  <Typography variant="h6">{user?.first_name} {user?.last_name}</Typography>
                  <Typography color="textSecondary" variant="body2">{user?.email}</Typography>
                </Box>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography color="textSecondary" variant="caption">ROLE</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{user?.role}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography color="textSecondary" variant="caption">STATUS</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>Active</Typography>
                </Grid>
              </Grid>
              <Button
                variant="outlined"
                fullWidth
                sx={{ mt: 3, borderRadius: '8px', textTransform: 'none' }}
                onClick={() => navigate('/student/profile')}
              >
                View Profile Settings
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Face Recognition Registration Quick Link */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', borderRadius: '16px', backgroundImage: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  AI Biometrics
                </Typography>
                <Typography color="textSecondary" variant="body2" sx={{ mb: 3 }}>
                  Your face data is encrypted into 512-dimensional vectors. No raw photos are saved. Register or update your face model now.
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<CameraAlt />}
                onClick={() => navigate('/student/register-face')}
                sx={{ borderRadius: '10px', textTransform: 'none', py: 1.2, fontWeight: 'bold' }}
              >
                Register / Update Face Data
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent History Table */}
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)', height: '100%' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                Recent Attendance Logs
              </Typography>
              {history.length === 0 ? (
                <Typography color="textSecondary">No attendance logs found yet.</Typography>
              ) : (
                <List>
                  {history.map((record, index) => (
                    <React.Fragment key={record._id || index}>
                      <ListItem sx={{ px: 0, py: 1.5 }}>
                        <ListItemText
                          primary={`Session marked: ${record.status.toUpperCase()}`}
                          secondary={new Date(record.marking_time || record.timestamp).toLocaleString()}
                        />
                        <Box sx={{ ml: 'auto', textAlign: 'right' }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: record.status === 'present' ? 'success.main' : (record.status === 'od' ? 'info.main' : 'error.main') }}>
                            {record.status.toUpperCase()}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Confidence: {((record.face_confidence || record.confidence || 0) * 100).toFixed(0)}%
                          </Typography>
                        </Box>
                      </ListItem>
                      {index < history.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Notifications Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)', height: '100%' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3, display: 'flex', alignItems: 'center' }}>
                <NotificationsActive sx={{ color: 'primary.main', mr: 1 }} />
                Notifications
              </Typography>
              {notifications.length === 0 ? (
                <Typography color="textSecondary">No notifications to show.</Typography>
              ) : (
                <List>
                  {notifications.map((notif, index) => (
                    <React.Fragment key={notif.id || index}>
                      <ListItem sx={{ px: 0, py: 1, alignItems: 'flex-start' }} button onClick={() => navigate('/student/notifications')}>
                        <ListItemText
                          primary={notif.title}
                          secondary={notif.message}
                          primaryTypographyProps={{ style: { fontWeight: notif.read ? 'normal' : 'bold', fontSize: '0.9rem' } }}
                          secondaryTypographyProps={{ style: { fontSize: '0.8rem' } }}
                        />
                      </ListItem>
                      {index < notifications.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default StudentDashboard;
