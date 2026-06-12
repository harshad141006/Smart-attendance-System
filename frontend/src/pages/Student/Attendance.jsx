import React, { useEffect, useState, useRef } from 'react';
import { Box, Card, CardContent, Typography, Button, Alert, CircularProgress, Grid, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem } from '@mui/material';
import { useCamera, useGeolocation } from '../../hooks';
import { studentService, attendanceService } from '../../services';
import { PhotoCamera, LocationOn, Wifi, Send, CheckCircle, Warning } from '@mui/icons-material';

const StudentAttendance = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  
  // Dialog controls
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [odOpen, setOdOpen] = useState(false);
  
  // Geolocation & WiFi mock
  const { location, error: geoError, loading: geoLoading, getLocation } = useGeolocation();
  const [wifiBssid, setWifiBssid] = useState('AA:BB:CC:DD:EE:FF'); // Default College BSSID
  const [odReason, setOdReason] = useState('');
  
  // Status messages
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Camera hooks
  const { startCamera, stopCamera, stream, error: cameraError } = useCamera();

  const fetchActiveSessions = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      setSuccessMsg('');
      const res = await attendanceService.getActiveSessions();
      setActiveSessions(res.data || []);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load active attendance sessions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveSessions();
  }, []);

  const handleOpenVerify = async (session) => {
    setSelectedSession(session);
    setVerifyOpen(true);
    setSuccessMsg('');
    setErrorMsg('');
    
    // Automatically trigger GPS lookup
    await getLocation();
    
    // Initialise camera
    setTimeout(async () => {
      if (videoRef.current) {
        await startCamera(videoRef.current);
      }
    }, 100);
  };

  const handleCloseVerify = () => {
    stopCamera();
    setVerifyOpen(false);
    setSelectedSession(null);
  };

  const handleMarkAttendance = async () => {
    if (!selectedSession || !location) {
      setErrorMsg('Missing session info or location details.');
      return;
    }
    
    if (!videoRef.current || !stream) {
      setErrorMsg('Webcam stream is inactive.');
      return;
    }

    setMarking(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const base64Image = canvas.toDataURL('image/jpeg', 0.9);
      
      const response = await studentService.markAttendance(
        selectedSession.id,
        base64Image,
        location.latitude,
        location.longitude,
        wifiBssid
      );
      
      setSuccessMsg(response.data.message || 'Attendance marked successfully!');
      handleCloseVerify();
      fetchActiveSessions();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to verify and mark attendance. Ensure face is matched and you are inside geofence.');
    } finally {
      setMarking(false);
    }
  };

  const handleOpenOD = (session) => {
    setSelectedSession(session);
    setOdOpen(true);
    setOdReason('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleCloseOD = () => {
    setOdOpen(false);
    setSelectedSession(null);
  };

  const handleSubmitOD = async () => {
    if (!odReason.trim()) {
      setErrorMsg('Please enter a valid reason for OD.');
      return;
    }
    
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      const res = await studentService.submitODRequest(selectedSession.id, odReason);
      setSuccessMsg(res.data.message || 'OD request submitted successfully.');
      handleCloseOD();
      fetchActiveSessions();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to submit OD request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 800, background: 'linear-gradient(to right, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Mark Attendance
      </Typography>
      <Typography color="textSecondary" variant="subtitle1" sx={{ mb: 4 }}>
        Mark attendance for ongoing sessions using facial recognition, geofencing, and wifi checks.
      </Typography>

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{errorMsg}</Alert>}

      {loading && activeSessions.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
          <CircularProgress />
        </Box>
      ) : activeSessions.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center', borderRadius: '16px', border: '1px dashed #cbd5e0', background: 'transparent' }}>
          <Typography color="textSecondary" variant="h6">
            No active attendance sessions currently.
          </Typography>
          <Typography color="textSecondary" variant="body2" sx={{ mt: 1 }}>
            Ongoing sessions created by your faculty will appear here in real-time.
          </Typography>
          <Button variant="outlined" color="primary" onClick={fetchActiveSessions} sx={{ mt: 3, borderRadius: '8px', textTransform: 'none' }}>
            Refresh List
          </Button>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {activeSessions.map((session) => (
            <Grid item xs={12} md={6} key={session.id}>
              <Card sx={{ borderRadius: '16px', boxShadow: '0 8px 16px rgba(0,0,0,0.04)', borderLeft: '5px solid #667eea', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="caption" sx={{ textTransform: 'uppercase', color: 'primary.main', fontWeight: 'bold' }}>
                    {session.subject_code}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {session.subject_name}
                  </Typography>
                  <Typography color="textSecondary" variant="subtitle2" sx={{ mb: 2 }}>
                    Session: {session.session_title}
                  </Typography>

                  <Grid container spacing={1} sx={{ mt: 1 }}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="textSecondary">DURATION</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{session.duration_minutes} Minutes</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="textSecondary">RADIUS</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{session.radius_meters} Meters</Typography>
                    </Grid>
                  </Grid>

                  {session.allow_faculty_hotspot && (
                    <Box sx={{ mt: 2, p: 1.5, bgcolor: '#fff4e5', border: '1px solid #ffe58f', borderRadius: '8px' }}>
                      <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#d48806', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Wifi fontSize="small" /> POWER CUT FALLBACK ACTIVE
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#d48806', mt: 0.5 }}>
                        Connect to Faculty Hotspot: <b>{session.hotspot_ssid || 'Unknown'}</b><br/>
                        <span style={{ fontSize: '0.75rem' }}>BSSID: {session.hotspot_bssid || 'Unknown'}</span>
                      </Typography>
                    </Box>
                  )}

                  {session.already_marked && (
                    <Alert severity="success" icon={<CheckCircle />} sx={{ mt: 2, borderRadius: '8px' }}>
                      Attendance Marked
                    </Alert>
                  )}
                  {session.od_status && (
                    <Alert severity="warning" icon={<Warning />} sx={{ mt: 2, borderRadius: '8px' }}>
                      OD Request: {session.od_status.toUpperCase()}
                    </Alert>
                  )}
                </CardContent>
                
                {!session.already_marked && !session.od_status && (
                  <Box sx={{ display: 'flex', gap: 1, p: 2, borderTop: '1px solid #f0f4f8' }}>
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={() => handleOpenVerify(session)}
                      sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
                    >
                      Verify & Mark
                    </Button>
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() => handleOpenOD(session)}
                      sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
                    >
                      Apply OD
                    </Button>
                  </Box>
                )}
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Face Verification & GPS Marking Dialog */}
      <Dialog open={verifyOpen} onClose={handleCloseVerify} maxWidth="sm" fullWidth PaperProps={{ style: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Mark Attendance: {selectedSession?.subject_name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: 1 }}>
            {/* Camera View */}
            <Box sx={{ position: 'relative', width: '100%', maxWidth: '320px', aspectRatio: '4/3', borderRadius: '12px', bgcolor: '#000', overflow: 'hidden', border: '2px solid #e2e8f0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {stream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <CircularProgress size={30} />
              )}
              {/* Target Oval */}
              {stream && (
                <Box sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '60%',
                  height: '75%',
                  border: '2px dashed #667eea',
                  borderRadius: '50%',
                  pointerEvents: 'none'
                }} />
              )}
            </Box>
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Verification Stats */}
            <Box sx={{ width: '100%', bgcolor: '#f7fafc', p: 2, borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              {/* Geolocation */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <LocationOn sx={{ color: location ? 'success.main' : 'warning.main' }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>GPS Geolocation</Typography>
                  {geoLoading ? (
                    <Typography variant="caption" color="textSecondary">Locating satellite position...</Typography>
                  ) : location ? (
                    <Typography variant="caption" color="success.main">
                      Lat: {location.latitude.toFixed(5)}, Lon: {location.longitude.toFixed(5)} (Acc: {location.accuracy?.toFixed(1)}m)
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="error.main">{geoError || 'GPS coordinates failed to load.'}</Typography>
                  )}
                </Box>
              </Box>

              {/* Wifi Config selector */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Wifi sx={{ color: 'primary.main' }} />
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>WiFi BSSID Network</Typography>
                  <TextField
                    select
                    value={wifiBssid}
                    onChange={(e) => setWifiBssid(e.target.value)}
                    variant="standard"
                    fullWidth
                    InputProps={{ style: { fontSize: '0.8rem' } }}
                  >
                    <MenuItem value="AA:BB:CC:DD:EE:FF">College WiFi Router (AA:BB:CC:DD:EE:FF)</MenuItem>
                    {selectedSession?.allow_faculty_hotspot && selectedSession?.hotspot_bssid && (
                      <MenuItem value={selectedSession.hotspot_bssid}>
                        Faculty Hotspot: {selectedSession.hotspot_ssid} ({selectedSession.hotspot_bssid})
                      </MenuItem>
                    )}
                    <MenuItem value="99:99:99:99:99:99">Unauthorized WiFi Network (99:99:99:99:99:99)</MenuItem>
                  </TextField>
                </Box>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseVerify} variant="outlined" sx={{ borderRadius: '8px' }}>
            Cancel
          </Button>
          <Button
            onClick={handleMarkAttendance}
            variant="contained"
            disabled={marking || !location || !stream}
            startIcon={marking ? <CircularProgress size={18} color="inherit" /> : <CheckCircle />}
            sx={{ borderRadius: '8px', fontWeight: 'bold' }}
          >
            {marking ? 'Verifying...' : 'Mark Present'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* On Duty Dialog */}
      <Dialog open={odOpen} onClose={handleCloseOD} maxWidth="xs" fullWidth PaperProps={{ style: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Apply for On Duty (OD)
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            If you are representing college sports/cultural clubs or attending approved off-campus placement drives during this class, enter your reason below.
          </Typography>
          <TextField
            label="Reason for OD"
            value={odReason}
            onChange={(e) => setOdReason(e.target.value)}
            multiline
            rows={4}
            fullWidth
            required
            variant="outlined"
            placeholder="e.g. Attending placement drive in Block A Seminar hall, sports tournament, etc."
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseOD} variant="outlined" sx={{ borderRadius: '8px' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitOD}
            variant="contained"
            color="secondary"
            startIcon={<Send />}
            sx={{ borderRadius: '8px', fontWeight: 'bold' }}
          >
            Submit Request
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StudentAttendance;
