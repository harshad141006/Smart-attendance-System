import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Button, Typography,
  CircularProgress, Grid, LinearProgress, Alert,
  IconButton
} from '@mui/material';
import { CameraAlt, CheckCircle, FaceRetouchingNatural, Delete } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '../../hooks';
import { useFaceValidator } from '../../hooks/useFaceValidator';
import { useFaceDetectionPoller } from '../../hooks/useFaceDetectionPoller';
import { studentService } from '../../services';

const MAX_FRAMES = 10;

const POSES = [
  { id: 1, label: 'Look Straight', icon: '🙂' },
  { id: 2, label: 'Turn Left', icon: '⬅' },
  { id: 3, label: 'Turn Right', icon: '➡' },
  { id: 4, label: 'Look Up', icon: '⬆' },
  { id: 5, label: 'Look Down', icon: '⬇' },
  { id: 6, label: 'Slight Left', icon: '↖' },
  { id: 7, label: 'Slight Right', icon: '↗' },
  { id: 8, label: 'Smile', icon: '😊' },
  { id: 9, label: 'Neutral Face', icon: '😐' },
  { id: 10, label: 'Blink or Angle', icon: '😉' },
];

export default function FaceRegistration() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const captureCanvasRef = useRef(null);

  // Phases: idle | live | submitting | done | error
  const [phase, setPhase] = useState('idle');
  const [serverMsg, setServerMsg] = useState('');
  const [serverError, setServerError] = useState('');

  // Multi-capture state
  const [capturedImages, setCapturedImages] = useState([]); // array of base64 strings

  const { startCamera, stopCamera, stream, error: cameraError } = useCamera();

  useFaceDetectionPoller(videoRef, captureCanvasRef, stream);
  const { liveStatus, captureFrame } = useFaceValidator(videoRef, overlayCanvasRef, stream);

  // Sync video srcObject
  useEffect(() => {
    if (stream && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleStart = useCallback(async () => {
    setServerMsg(''); setServerError('');
    setCapturedImages([]);
    const s = await startCamera(videoRef.current);
    if (s) setPhase('live');
  }, [startCamera]);

  const handleStop = useCallback(() => {
    stopCamera(); setPhase('idle'); setServerError('');
  }, [stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const handleCapture = useCallback(() => {
    if (liveStatus.status !== 'ready') return;
    const frameData = captureFrame();
    if (frameData && frameData.b64) {
      setCapturedImages(prev => {
        const newImages = [...prev, frameData.b64];
        if (newImages.length === MAX_FRAMES) {
          submitImages(newImages);
        }
        return newImages;
      });
    }
  }, [liveStatus.status, captureFrame]);
  
  const submitImages = (images) => {
    setPhase('submitting');
    studentService.registerFace(images)
      .then(res => {
        const data = res.data;
        if (data.success === false) {
          setServerError(data.message || 'Registration failed');
          setPhase('error');
        } else {
          setServerMsg(data.message || 'Face registered successfully');
          setPhase('done');
          stopCamera();
          setTimeout(() => navigate('/student/dashboard'), 3000);
        }
      })
      .catch(err => {
        const d = err.response?.data?.detail;
        const msg = (typeof d === 'object' ? d?.message : d) || 'Registration failed. Please try again.';
        setServerError(msg);
        setPhase('error');
      });
  };

  const handleRetryError = useCallback(() => {
    setServerError('');
    setCapturedImages([]);
    setPhase('live');
  }, []);

  const handleDeleteImage = (index) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
  };

  const isLive = phase === 'live';
  const isSubmitting = phase === 'submitting';
  const isDone = phase === 'done';
  const isError = phase === 'error';

  const currentIndex = Math.min(capturedImages.length, MAX_FRAMES - 1);
  const currentPose = POSES[currentIndex];

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 800, background: 'linear-gradient(to right, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Face Registration
      </Typography>
      <Typography color="textSecondary" variant="subtitle1" sx={{ mb: 3 }}>
        Provide {MAX_FRAMES} distinct poses to register your face.
      </Typography>

      <Grid container spacing={3} justifyContent="center">
        {/* Main Camera View */}
        <Grid item xs={12} md={7}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>

              {/* Progress */}
              {(isLive || isSubmitting || isDone) && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                    {isDone ? 'Registration Complete' : `Current Pose: ${currentPose.label}`}
                  </Typography>
                  <LinearProgress variant="determinate" value={(capturedImages.length / MAX_FRAMES) * 100} sx={{ height: 10, borderRadius: 5 }} />
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, fontWeight: 'bold' }}>
                    Captured: {capturedImages.length} / {MAX_FRAMES}
                  </Typography>
                </Box>
              )}

              {/* Viewport */}
              <Box sx={{ position: 'relative', width: '100%', maxWidth: 520, margin: '0 auto', aspectRatio: '4/3', borderRadius: '12px', bgcolor: '#0a0a0a', overflow: 'hidden' }}>
                
                {/* Live Video */}
                {(isLive || isSubmitting || isError || isDone) && stream ? (
                  <video ref={videoRef} autoPlay playsInline muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : null}

                {/* Idle / No Camera */}
                {!stream && (
                  <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#555', gap: 2 }}>
                    <FaceRetouchingNatural sx={{ fontSize: 64 }} />
                    <Typography variant="body2">Camera inactive</Typography>
                  </Box>
                )}

                {/* Live Overlay */}
                <canvas ref={overlayCanvasRef}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', display: isLive ? 'block' : 'none' }} />

                {/* Submitting overlay */}
                {isSubmitting && (
                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.7)', gap: 2 }}>
                    <CircularProgress size={52} sx={{ color: '#22c55e' }} />
                    <Typography sx={{ color: '#fff', fontWeight: 700 }}>Training face model...</Typography>
                  </Box>
                )}
              </Box>

              {/* Hidden canvas for poller */}
              <canvas ref={captureCanvasRef} style={{ display: 'none' }} />

              {/* Live Status Messaging */}
              {isLive && (
                <Box sx={{ mt: 2.5 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: liveStatus.color, transition: 'color 0.3s ease' }}>
                    {liveStatus.message}
                  </Typography>
                </Box>
              )}

              {/* Capture Button */}
              {isLive && capturedImages.length < MAX_FRAMES && (
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    size="large"
                    disabled={liveStatus.status !== 'ready'}
                    onClick={handleCapture}
                    sx={{
                      borderRadius: '50px',
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '1.2rem',
                      px: 6,
                      py: 1.5,
                      background: liveStatus.status === 'ready' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#ccc',
                      color: '#fff',
                      pointerEvents: liveStatus.status === 'ready' ? 'auto' : 'none'
                    }}
                  >
                    Capture
                  </Button>
                </Box>
              )}

              {/* Success */}
              {isDone && (
                <Box sx={{ mt: 2.5, p: 2.5, borderRadius: '12px', bgcolor: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.22)', textAlign: 'center' }}>
                  <CheckCircle sx={{ color: '#22c55e', fontSize: 48, mb: 1 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#22c55e' }}>{serverMsg}</Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>Redirecting to dashboard...</Typography>
                </Box>
              )}

              {/* Error */}
              {isError && (
                <Box sx={{ mt: 2, p: 2, borderRadius: '12px', bgcolor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)' }}>
                  <Typography variant="body2" sx={{ color: '#ef4444', fontWeight: 600, mb: 1.5 }}>{serverError}</Typography>
                  <Button variant="outlined" color="error" size="small" onClick={handleRetryError}
                    sx={{ borderRadius: '8px', textTransform: 'none' }}>
                    Retry Enrollment
                  </Button>
                </Box>
              )}

              {cameraError && (
                <Typography variant="body2" sx={{ mt: 2, color: '#ef4444' }}>Camera error: {cameraError}</Typography>
              )}

              {/* Controls */}
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 2 }}>
                {!stream && !isDone && (
                  <Button variant="contained" startIcon={<CameraAlt />} onClick={handleStart}
                    sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, px: 3, py: 1.2, background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
                    Start Registration
                  </Button>
                )}
                {stream && !isSubmitting && (
                  <Button variant="outlined" color="error" onClick={handleStop}
                    sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}>
                    Cancel
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Tips / Poses panel */}
        <Grid item xs={12} md={5}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.07)', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2.5 }}>How to Position Your Face</Typography>
              <Grid container spacing={2}>
                {POSES.map((pose, index) => {
                  const isCompleted = index < capturedImages.length;
                  const isCurrent = index === capturedImages.length;
                  let borderColor = '#eee';
                  let bgColor = '#fafafa';
                  
                  if (isCompleted) {
                    borderColor = '#22c55e';
                    bgColor = 'rgba(34,197,94,0.1)';
                  } else if (isCurrent) {
                    borderColor = '#3b82f6';
                    bgColor = 'rgba(59,130,246,0.1)';
                  }
                  
                  return (
                    <Grid item xs={6} key={pose.id}>
                      <Box sx={{
                        p: 1.5,
                        borderRadius: '8px',
                        border: `2px solid ${borderColor}`,
                        backgroundColor: bgColor,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        transition: 'all 0.3s ease'
                      }}>
                        <Typography sx={{ fontSize: '1.5rem' }}>{pose.icon}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#1e3a8a' : isCompleted ? '#166534' : '#666' }}>
                          {pose.label}
                        </Typography>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>

              {/* Thumbnails */}
              {capturedImages.length > 0 && (
                <Box sx={{ mt: 4 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Captured Images</Typography>
                  <Grid container spacing={1}>
                    {capturedImages.map((imgSrc, idx) => (
                      <Grid item xs={3} key={idx}>
                        <Box sx={{ position: 'relative', paddingTop: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ddd' }}>
                          <img src={imgSrc} alt={`Capture ${idx + 1}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                          <IconButton 
                            size="small" 
                            onClick={() => handleDeleteImage(idx)}
                            sx={{ position: 'absolute', top: 2, right: 2, bgcolor: 'rgba(0,0,0,0.5)', color: 'white', '&:hover': { bgcolor: 'rgba(239,68,68,0.8)' } }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
