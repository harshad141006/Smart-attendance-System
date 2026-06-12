import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Grid, Button, CircularProgress, List, ListItem, ListItemText, Divider, Alert, Chip, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks';
import { facultyService, timetableService } from '../../services';
import { Assignment, People, BarChart, Add, Wifi, AccessTime, School, PlayCircleOutline } from '@mui/icons-material';

const FacultyDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [todayPeriods, setTodayPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Hotspot Config State
  const [facultyHotspotSSID, setFacultyHotspotSSID] = useState('');
  const [facultyHotspotBSSID, setFacultyHotspotBSSID] = useState('');
  const [hotspotSubmitting, setHotspotSubmitting] = useState(false);
  const [hotspotSuccessMsg, setHotspotSuccessMsg] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [sessionRes, ttRes] = await Promise.all([
          facultyService.getSessions(),
          timetableService.getFacultyTimetable()
        ]);
        setSessions(sessionRes.data.sessions || []);
        
        // Simple logic to show periods (for demo, showing all assigned)
        // In real app, filter by actual today's day_of_week
        setTodayPeriods(ttRes.data || []);
      } catch (err) {
        console.error(err);
        setErrorMsg('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const handleUpdateHotspot = async () => {
    setHotspotSubmitting(true);
    setErrorMsg('');
    setHotspotSuccessMsg('');
    try {
      await facultyService.updateHotspotConfig(user.id || user._id, facultyHotspotSSID, facultyHotspotBSSID);
      setHotspotSuccessMsg('Hotspot Configuration updated successfully.');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to update hotspot configuration.');
    } finally {
      setHotspotSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const activeSession = sessions.find(s => s.status === 'active');
  const scheduledCount = sessions.filter(s => s.status === 'scheduled').length;
  const endedCount = sessions.filter(s => s.status === 'ended').length;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, background: 'linear-gradient(to right, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Faculty Dashboard
          </Typography>
          <Typography color="textSecondary" variant="subtitle1">
            Create attendance sessions, manage live attendance streams, and generate rosters.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={() => navigate('/faculty/create-session')}
          sx={{ borderRadius: '12px', px: 3, py: 1.2, textTransform: 'none', fontWeight: 'bold', backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        >
          Create New Session
        </Button>
      </Box>

      {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}

      {/* active session alert banner */}
      {activeSession && (
        <Alert
          severity="info"
          sx={{ mb: 4, borderRadius: '16px', py: 2 }}
          action={
            <Button color="inherit" size="small" variant="outlined" onClick={() => navigate('/faculty/live-attendance')} sx={{ fontWeight: 'bold', textTransform: 'none', borderRadius: '8px' }}>
              View Live attendance
            </Button>
          }
        >
          <Typography sx={{ fontWeight: 'bold' }}>Ongoing Attendance Marking Window Active!</Typography>
          Subject Session "{activeSession.session_title}" is accepting student submissions. Duration remaining.
        </Alert>
      )}

      {/* Metrics Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(102, 126, 234, 0.1)', mr: 2 }}>
                <Assignment sx={{ fontSize: 32, color: 'primary.main' }} />
              </Box>
              <Box>
                <Typography color="textSecondary" variant="caption">ACTIVE SESSIONS</Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                  {activeSession ? '1 Active' : '0 Active'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(76, 175, 80, 0.1)', mr: 2 }}>
                <People sx={{ fontSize: 32, color: 'success.main' }} />
              </Box>
              <Box>
                <Typography color="textSecondary" variant="caption">SCHEDULED SESSIONS</Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 0.5 }}>{scheduledCount}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(237, 137, 54, 0.1)', mr: 2 }}>
                <BarChart sx={{ fontSize: 32, color: 'warning.main' }} />
              </Box>
              <Box>
                <Typography color="textSecondary" variant="caption">COMPLETED WINDOWS</Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 0.5 }}>{endedCount}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* My Schedule Today */}
      <Card sx={{ mb: 4, borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3, display: 'flex', alignItems: 'center' }}>
            <School sx={{ mr: 1, color: 'primary.main' }} />
            My Schedule Today
          </Typography>
          
          {todayPeriods.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: '12px' }}>
              You have no academic periods scheduled for today.
            </Alert>
          ) : (
            <Grid container spacing={3}>
              {todayPeriods.map((p, idx) => (
                <Grid item xs={12} md={6} key={idx}>
                  <Card variant="outlined" sx={{ borderRadius: '12px', borderLeft: '4px solid #667eea' }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {p.title || `Lecture ${idx + 1}`}
                          </Typography>
                          <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                            {p.subject_name} ({p.batch} - {p.department} - {p.section})
                          </Typography>
                          <Typography variant="body2" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 'bold' }}>
                            <AccessTime fontSize="small" /> {p.start_time} - {p.end_time}
                          </Typography>
                        </Box>
                        <Button 
                          variant="contained" 
                          size="small" 
                          startIcon={<PlayCircleOutline />}
                          onClick={() => navigate('/faculty/create-session', { state: { prefill: p } })}
                          sx={{ textTransform: 'none', borderRadius: '8px' }}
                        >
                          Start
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* My Hotspot Configuration */}
      <Card sx={{ mb: 4, borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3, display: 'flex', alignItems: 'center' }}>
            <Wifi sx={{ mr: 1, color: 'secondary.main' }} />
            My Hotspot Configuration
          </Typography>
          <Typography color="textSecondary" sx={{ mb: 3 }}>
            Set your mobile hotspot details. Students will connect to this network during a power cut.
          </Typography>
          
          {hotspotSuccessMsg && <Alert severity="success" sx={{ mb: 3 }}>{hotspotSuccessMsg}</Alert>}

          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Hotspot SSID (Network Name)"
                value={facultyHotspotSSID}
                onChange={(e) => setFacultyHotspotSSID(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Hotspot BSSID (MAC Address)"
                value={facultyHotspotBSSID}
                onChange={(e) => setFacultyHotspotBSSID(e.target.value)}
                size="small"
                placeholder="e.g. 00:11:22:33:44:55"
              />
            </Grid>
            <Grid item xs={12} sm={4} sx={{ display: 'flex', alignItems: 'center' }}>
              <Button
                variant="contained"
                color="secondary"
                fullWidth
                onClick={handleUpdateHotspot}
                disabled={hotspotSubmitting || !facultyHotspotSSID || !facultyHotspotBSSID}
                sx={{ borderRadius: '8px', textTransform: 'none' }}
              >
                {hotspotSubmitting ? 'Updating...' : 'Update Config'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Recent Sessions list */}
      <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
            Recent Attendance Sessions
          </Typography>

          {sessions.length === 0 ? (
            <Typography color="textSecondary">No sessions created yet. Click Create New Session above to begin.</Typography>
          ) : (
            <List>
              {sessions.map((session, index) => (
                <React.Fragment key={session._id || index}>
                  <ListItem sx={{ px: 0, py: 2 }}>
                    <ListItemText
                      primary={session.session_title}
                      secondary={`Duration: ${session.duration_minutes} Mins | Radius: ${session.radius_meters}m | Started: ${session.actual_start_time ? new Date(session.actual_start_time).toLocaleString() : 'N/A'}`}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip
                        label={session.status.toUpperCase()}
                        color={session.status === 'active' ? 'success' : (session.status === 'scheduled' ? 'primary' : 'default')}
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {session.total_students_present} present
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => navigate('/faculty/reports')}
                        sx={{ textTransform: 'none', borderRadius: '8px' }}
                      >
                        View Report
                      </Button>
                    </Box>
                  </ListItem>
                  {index < sessions.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default FacultyDashboard;
