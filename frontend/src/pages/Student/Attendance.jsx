import React, { useEffect, useState, useRef } from 'react';
import { Box, Card, CardContent, Typography, Button, Alert, CircularProgress, Grid, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, LinearProgress, Paper, useTheme, useMediaQuery, IconButton } from '@mui/material';
import { useCamera, useGeolocation } from '../../hooks';
import { studentService, attendanceService, timetableService } from '../../services';
import { PhotoCamera, LocationOn, Wifi, Send, CheckCircle, Warning, Stop, LocalCafe, School, AccessTime, Close } from '@mui/icons-material';
import { Capacitor } from '@capacitor/core';
import { CapacitorWifi } from '@capgo/capacitor-wifi';

const StudentAttendance = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [activeSessions, setActiveSessions] = useState([]);
  const [todayTimetable, setTodayTimetable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  
  // Dialog controls
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [odOpen, setOdOpen] = useState(false);
  const [autoMarkAttempted, setAutoMarkAttempted] = useState(false);
  
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
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
      const [res, timeRes] = await Promise.all([
        attendanceService.getActiveSessions(),
        timetableService.getTodayTimetable().catch(() => ({ data: null }))
      ]);
      setActiveSessions(res.data || []);
      setTodayTimetable(timeRes.data || null);
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
    setAutoMarkAttempted(false);
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
    stopRecording();
    stopCamera();
    setVerifyOpen(false);
    setSelectedSession(null);
  };

  const startRecording = () => {
    if (!stream) return;
    chunksRef.current = [];
    
    let options = {};
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      options = { mimeType: 'video/webm;codecs=vp8' };
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      options = { mimeType: 'video/webm' };
    }

    try {
      const recorder = new MediaRecorder(stream, options);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
        handleVerifyVideo(blob);
        setRecording(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordingTime(5);
    } catch (err) {
      console.error('Error starting media recorder:', err);
      setErrorMsg('Failed to initialize video recording.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  useEffect(() => {
    let interval;
    if (recording && recordingTime > 0) {
      interval = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [recording, recordingTime]);

  useEffect(() => {
    if (verifyOpen && stream && location && !geoLoading && !marking && !autoMarkAttempted && !errorMsg) {
      setAutoMarkAttempted(true);
      // Wait 2 seconds for camera to focus and lighting to adjust, then auto start recording
      const timer = setTimeout(() => {
        startRecording();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [verifyOpen, stream, location, geoLoading, marking, autoMarkAttempted, errorMsg]);

  const handleVerifyVideo = async (blob) => {
    if (!selectedSession || !location) {
      setErrorMsg('Missing session info or location details.');
      return;
    }
    
    setMarking(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      let finalBssid = wifiBssid;
      let finalRssi = null;

      if (Capacitor.isNativePlatform()) {
        try {
          const permissionStatus = await CapacitorWifi.requestPermissions();
          if (permissionStatus.location === 'granted') {
            const wifiInfo = await CapacitorWifi.getWifiInfo();
            if (wifiInfo.bssid) {
              finalBssid = wifiInfo.bssid;
              finalRssi = wifiInfo.rssi !== undefined ? parseInt(wifiInfo.rssi) : null;
            }
          } else {
            console.warn("WiFi Location permission denied.");
          }
        } catch (wifiErr) {
          console.error("Failed to fetch native WiFi details:", wifiErr);
          throw new Error('Could not read WiFi details. Please ensure location permissions are granted in device settings.');
        }
      }

      // 1. Send video for face verification
      const verifyRes = await studentService.detectFaceVideo(blob);
      if (!verifyRes.data.verified) {
        throw new Error('Video Face Verification failed. The live video did not match your registered profile.');
      }
      
      // 2. Grab a frame to send for attendance marking
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      // Draw horizontally flipped image since the video has scaleX(-1) applied usually
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.9);
      
      // 3. Mark attendance
      const response = await studentService.markAttendance(
        selectedSession.id,
        base64Image,
        location.latitude,
        location.longitude,
        finalBssid,
        finalRssi,
        false // hotspotOnly = false
      );
      
      setSuccessMsg(response.data.message || 'Attendance marked successfully!');
      setTimeout(() => {
        handleCloseVerify();
        fetchActiveSessions();
      }, 2000);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || err.message || 'Verification and marking process failed.');
    } finally {
      setMarking(false);
    }
  };

  const handleMarkHotspot = async (session) => {
    setMarking(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      let finalBssid = session.hotspot_bssid || wifiBssid;
      let finalRssi = null;

      if (Capacitor.isNativePlatform()) {
        try {
          const permissionStatus = await CapacitorWifi.requestPermissions();
          if (permissionStatus.location === 'granted') {
            const wifiInfo = await CapacitorWifi.getWifiInfo();
            if (wifiInfo.bssid) {
              finalBssid = wifiInfo.bssid;
              finalRssi = wifiInfo.rssi !== undefined ? parseInt(wifiInfo.rssi) : null;
            }
          } else {
            console.warn("WiFi Location permission denied.");
          }
        } catch (wifiErr) {
          console.error("Failed to fetch native WiFi details:", wifiErr);
          throw new Error('Could not read WiFi details. Please ensure location permissions are granted in device settings.');
        }
      }
      
      // Location could be mocked or fetched if needed, but the primary validation is wifi
      const lat = location ? location.latitude : 0;
      const lng = location ? location.longitude : 0;

      const response = await studentService.markAttendance(
        session.id,
        null, // No image data needed for hotspot only
        lat,
        lng,
        finalBssid,
        finalRssi,
        true // hotspotOnly = true
      );
      
      setSuccessMsg(response.data.message || 'Attendance marked successfully via Hotspot!');
      setTimeout(() => {
        fetchActiveSessions();
      }, 2000);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || err.message || 'Hotspot marking failed.');
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

      {/* Today's Timetable Section */}
      <Card sx={{ mb: 4, borderRadius: '16px', boxShadow: '0 8px 16px rgba(0,0,0,0.04)' }}>
        <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
          <Typography variant="h6" fontWeight="bold">
            Today's Timetable ({todayTimetable?.day_of_week || 'N/A'})
          </Typography>
        </Box>
        <CardContent sx={{ p: 3, maxHeight: '300px', overflowY: 'auto' }}>
          {(!todayTimetable?.periods || todayTimetable.periods.length === 0) ? (
            <Typography color="textSecondary">No classes scheduled for today.</Typography>
          ) : (
            [...todayTimetable.periods].sort((a, b) => a.start_time.localeCompare(b.start_time)).map((p, pIdx) => (
              <Paper 
                key={pIdx} 
                elevation={0}
                sx={{ 
                  p: 2, mb: 2, 
                  bgcolor: p.is_break ? '#fffaf0' : '#f8fafc',
                  borderLeft: `4px solid ${p.is_break ? '#ed8936' : '#667eea'}`,
                  borderRadius: '8px'
                }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {p.is_break ? <LocalCafe fontSize="small" color="secondary" /> : <School fontSize="small" color="primary" />}
                      {p.is_break ? p.title : `Lecture ${pIdx + 1} - ${p.title}`}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                      <AccessTime fontSize="small" sx={{ fontSize: 16 }} /> {p.start_time} - {p.end_time}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            ))
          )}
        </CardContent>
      </Card>

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
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 2, borderTop: '1px solid #f0f4f8' }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={() => handleOpenVerify(session)}
                        sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
                      >
                        Mark via Class WiFi
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
                    {session.allow_faculty_hotspot && (
                      <Button
                        variant="contained"
                        color="warning"
                        fullWidth
                        onClick={() => handleMarkHotspot(session)}
                        disabled={marking}
                        startIcon={marking ? <CircularProgress size={18} color="inherit" /> : <Wifi />}
                        sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold', mt: 1 }}
                      >
                        {marking ? 'Marking...' : 'Mark via Faculty Mobile'}
                      </Button>
                    )}
                  </Box>
                )}
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Face Verification & GPS Marking Dialog */}
      <Dialog 
        open={verifyOpen} 
        onClose={handleCloseVerify} 
        maxWidth="sm" 
        fullWidth 
        fullScreen={isMobile}
        PaperProps={{ 
          style: { 
            borderRadius: isMobile ? 0 : '24px',
            backgroundColor: isMobile ? '#000' : '#fff',
            color: isMobile ? '#fff' : 'inherit',
          } 
        }}
      >
        <DialogTitle sx={{ 
          fontWeight: 'bold', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          color: isMobile ? '#fff' : 'inherit'
        }}>
          {selectedSession?.subject_name}
          {isMobile && (
            <IconButton onClick={handleCloseVerify} sx={{ color: 'white' }}>
              <Close />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: 1 }}>
            <Box sx={{ 
              position: 'relative', 
              width: '100%', 
              height: isMobile ? '60vh' : 'auto',
              maxWidth: isMobile ? '100%' : '320px', 
              aspectRatio: isMobile ? 'auto' : '4/3', 
              borderRadius: isMobile ? '24px' : '16px', 
              bgcolor: '#000', 
              overflow: 'hidden', 
              border: isMobile ? 'none' : '4px solid #e2e8f0',
              boxShadow: isMobile ? 'none' : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center' 
            }}>
              {stream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                />
              ) : (
                <CircularProgress size={30} sx={{ color: 'white' }} />
              )}
              {/* Target Oval and Recording Overlay */}
              {stream && (
                <Box sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: isMobile ? '70%' : '60%',
                  height: isMobile ? '60%' : '75%',
                  border: recording ? '4px solid #ef4444' : '4px dashed rgba(255,255,255,0.7)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  boxShadow: recording ? '0 0 20px rgba(239, 68, 68, 0.8)' : '0 0 0 9999px rgba(0,0,0,0.5)',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {recording && (
                    <Box sx={{
                      position: 'absolute',
                      bottom: '-40px',
                      color: '#fff',
                      bgcolor: 'rgba(239, 68, 68, 0.9)',
                      px: 2,
                      py: 0.5,
                      borderRadius: '20px',
                      fontSize: '0.875rem',
                      fontWeight: 'bold',
                      animation: 'pulse 1s infinite',
                      backdropFilter: 'blur(4px)'
                    }}>
                      REC {recordingTime}s
                    </Box>
                  )}
                </Box>
              )}
            </Box>
            
            {recording && (
              <Box sx={{ width: '100%', mt: 2, px: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={(recordingTime / 5) * 100}
                  color="error"
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            )}

            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Verification Stats */}
            <Box sx={{ 
              width: '100%', 
              bgcolor: isMobile ? 'rgba(255,255,255,0.1)' : '#f8fafc', 
              p: 2, 
              borderRadius: '16px', 
              border: isMobile ? '1px solid rgba(255,255,255,0.2)' : '1px solid #e2e8f0',
              backdropFilter: isMobile ? 'blur(10px)' : 'none'
            }}>
              {/* Geolocation */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box sx={{ p: 1, bgcolor: isMobile ? 'rgba(0,0,0,0.3)' : '#fff', borderRadius: '50%', display: 'flex' }}>
                  <LocationOn sx={{ color: location ? (isMobile ? '#4ade80' : 'success.main') : (isMobile ? '#fbbf24' : 'warning.main') }} />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>GPS Geolocation</Typography>
                  {geoLoading ? (
                    <Typography variant="caption" sx={{ color: isMobile ? 'rgba(255,255,255,0.7)' : 'text.secondary' }}>Locating satellite position...</Typography>
                  ) : location ? (
                    <Typography variant="caption" sx={{ color: isMobile ? '#4ade80' : 'success.main' }}>
                      Lat: {location.latitude.toFixed(5)}, Lon: {location.longitude.toFixed(5)} (Acc: {location.accuracy?.toFixed(1)}m)
                    </Typography>
                  ) : (
                    <Typography variant="caption" sx={{ color: isMobile ? '#f87171' : 'error.main' }}>{geoError || 'GPS coordinates failed to load.'}</Typography>
                  )}
                </Box>
              </Box>

              {/* Wifi Config selector */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ p: 1, bgcolor: isMobile ? 'rgba(0,0,0,0.3)' : '#fff', borderRadius: '50%', display: 'flex' }}>
                  <Wifi sx={{ color: isMobile ? '#60a5fa' : 'primary.main' }} />
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>WiFi BSSID Network</Typography>
                  {Capacitor.isNativePlatform() ? (
                    <Typography variant="caption" sx={{ color: isMobile ? '#4ade80' : 'success.main' }}>
                      Auto-detecting from native device...
                    </Typography>
                  ) : (
                    <TextField
                      select
                      value={wifiBssid}
                      onChange={(e) => setWifiBssid(e.target.value)}
                      variant="standard"
                      fullWidth
                      InputProps={{ style: { fontSize: '0.8rem', color: isMobile ? '#fff' : 'inherit' } }}
                      sx={{
                        '& .MuiSelect-icon': { color: isMobile ? '#fff' : 'inherit' },
                        '& .MuiInput-underline:before': { borderBottomColor: isMobile ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.42)' },
                        '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottomColor: isMobile ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.87)' },
                      }}
                    >
                      {selectedSession?.hotspot_bssid ? (
                        <MenuItem value={selectedSession.hotspot_bssid}>
                          Teacher Hotspot: {selectedSession.hotspot_ssid}
                        </MenuItem>
                      ) : (
                        <MenuItem value="" disabled>Teacher Hotspot Not Configured</MenuItem>
                      )}
                      <MenuItem value="99:99:99:99:99:99">Unauthorized WiFi Network</MenuItem>
                    </TextField>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: isMobile ? 3 : 3, pb: isMobile ? 4 : 3, justifyContent: 'center', bgcolor: isMobile ? '#000' : 'transparent' }}>
          {!isMobile && (
            <Button onClick={handleCloseVerify} variant="outlined" sx={{ borderRadius: '12px', px: 3 }}>
              Cancel
            </Button>
          )}
          {recording ? (
             <Button
                variant="contained"
                color="error"
                startIcon={<Stop />}
                onClick={stopRecording}
                fullWidth={isMobile}
                sx={{ borderRadius: '12px', fontWeight: 'bold', py: 1.5, px: 4, boxShadow: '0 8px 16px rgba(239,68,68,0.3)' }}
             >
                Stop Recording
             </Button>
          ) : (
            <Button
              onClick={() => {
                 setAutoMarkAttempted(true);
                 startRecording();
              }}
              variant="contained"
              disabled={marking || !location || !stream}
              startIcon={marking ? <CircularProgress size={18} color="inherit" /> : <CheckCircle />}
              fullWidth={isMobile}
              sx={{ borderRadius: '12px', fontWeight: 'bold', py: 1.5, px: 4, boxShadow: '0 8px 16px rgba(102,126,234,0.3)' }}
            >
              {marking ? 'Verifying...' : (autoMarkAttempted && !successMsg && !errorMsg ? 'Starting Video...' : 'Start Video Verification')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>

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
