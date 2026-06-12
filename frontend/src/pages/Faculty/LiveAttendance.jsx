import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Grid, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert, IconButton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { facultyService, studentService, subjectService } from '../../services';
import { Stop, Check, Close, LocalActivity, Refresh } from '@mui/icons-material';

const LiveAttendance = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState(null);
  const [roster, setRoster] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(null);

  const loadLiveRoster = async () => {
    try {
      setErrorMsg('');
      const sessionsRes = await facultyService.getSessions();
      const active = sessionsRes.data.sessions.find(s => s.status === 'active');
      
      if (active) {
        setActiveSession(active);
        // Get roster data for export (it contains student names and statuses)
        const rosterRes = await facultyService.exportSessionAttendance(active.id || active._id);
        setRoster(rosterRes.data.export_data || []);
      } else {
        setActiveSession(null);
        setRoster([]);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load live session details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLiveRoster();
    
    // Set up polling interval to fetch attendance logs every 5 seconds
    const interval = setInterval(() => {
      loadLiveRoster();
    }, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleEndSession = async () => {
    if (!activeSession) return;
    try {
      setLoading(true);
      await facultyService.endSession(activeSession.id || activeSession._id);
      setSuccessMsg('Attendance session closed successfully.');
      loadLiveRoster();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to end session.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualMark = async (studentId, status) => {
    if (!activeSession) return;
    try {
      setErrorMsg('');
      setSuccessMsg('');
      const sessId = activeSession.id || activeSession._id;
      await facultyService.manualMarkAttendance(sessId, studentId, status);
      setSuccessMsg(`Student status updated to ${status}.`);
      loadLiveRoster();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to manually update attendance record.');
    }
  };

  if (loading && !activeSession) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, background: 'linear-gradient(to right, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Live Attendance Roster
          </Typography>
          <Typography color="textSecondary" variant="subtitle1">
            Real-time feed of student check-ins. Click Refresh or override manually.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadLiveRoster}
            sx={{ borderRadius: '8px', textTransform: 'none' }}
          >
            Refresh Feed
          </Button>
          {activeSession && (
            <Button
              variant="contained"
              color="error"
              startIcon={<Stop />}
              onClick={handleEndSession}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
            >
              End Session
            </Button>
          )}
        </Box>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{errorMsg}</Alert>}

      {!activeSession ? (
        <Card sx={{ p: 4, textAlign: 'center', borderRadius: '16px', border: '1px dashed #cbd5e0', background: 'transparent' }}>
          <Typography color="textSecondary" variant="h6">
            No active attendance sessions currently.
          </Typography>
          <Typography color="textSecondary" variant="body2" sx={{ mt: 1 }}>
            Launch a new attendance session using the form to start receiving logs.
          </Typography>
          <Button variant="contained" color="primary" onClick={() => navigate('/faculty/create-session')} sx={{ mt: 3, borderRadius: '8px', textTransform: 'none' }}>
            Create Session
          </Button>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {/* Active Session details */}
          <Grid item xs={12}>
            <Card sx={{ borderRadius: '16px', boxShadow: '0 8px 16px rgba(0,0,0,0.03)', borderLeft: '5px solid #667eea' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {activeSession.session_title}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Typography color="textSecondary" variant="caption">DURATION</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{activeSession.duration_minutes} Mins</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography color="textSecondary" variant="caption">GEOFENCE LIMIT</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{activeSession.radius_meters}m</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography color="textSecondary" variant="caption">PRESENT COUNT</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                      {roster.filter(r => r.status === 'present').length} Present
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography color="textSecondary" variant="caption">TOTAL ROSTER</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{roster.length} Students</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Student Grid */}
          <Grid item xs={12}>
            <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Student Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Enrollment Number</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Section / Batch</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Attendance Status</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Marking Timestamp</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Manual Actions Override</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {roster.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                          No students in this class.
                        </TableCell>
                      </TableRow>
                    ) : (
                      roster.map((row) => (
                        <TableRow key={row.student_id} sx={{ '&:hover': { bgcolor: '#f7fafc' } }}>
                          <TableCell sx={{ fontWeight: '500' }}>{row.first_name} {row.last_name}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{row.enrollment_number}</TableCell>
                          <TableCell>{row.batch} - Section A</TableCell>
                          <TableCell>
                            <Chip
                              label={row.status.toUpperCase()}
                              color={row.status === 'present' ? 'success' : (row.status === 'od' ? 'info' : 'error')}
                              size="small"
                              sx={{ fontWeight: 'bold' }}
                            />
                          </TableCell>
                          <TableCell>
                            {row.marking_time ? new Date(row.marking_time).toLocaleTimeString() : '—'}
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                              <IconButton
                                size="small"
                                color="success"
                                title="Mark Present"
                                onClick={() => handleManualMark(row.student_id, 'present')}
                                disabled={row.status === 'present'}
                              >
                                <Check />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                title="Mark Absent"
                                onClick={() => handleManualMark(row.student_id, 'absent')}
                                disabled={row.status === 'absent'}
                              >
                                <Close />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="info"
                                title="Mark On Duty (OD)"
                                onClick={() => handleManualMark(row.student_id, 'od')}
                                disabled={row.status === 'od'}
                              >
                                <LocalActivity />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default LiveAttendance;
