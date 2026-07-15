import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Box, Card, CardContent, Button, Typography,
  CircularProgress, Grid, LinearProgress, Alert
} from '@mui/material';
import { CameraAlt, CheckCircle, FaceRetouchingNatural } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '../../hooks';
import { useFaceValidator } from '../../hooks/useFaceValidator';
import { useFaceDetectionPoller } from '../../hooks/useFaceDetectionPoller';
import { studentService } from '../../services';

const MAX_FRAMES = 30;
const CAPTURE_INTERVAL_MS = 400;

export default function FaceRegistration() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const captureCanvasRef = useRef(null);

  // Phases: idle | live | auto-capturing | submitting | done | error
  const [phase, setPhase] = useState('idle');
  const [serverMsg, setServerMsg] = useState('');
  const [serverError, setServerError] = useState('');

  // Multi-capture state
  const [capturedImages, setCapturedImages] = useState([]);
  const [captureInstruction, setCaptureInstruction] = useState('Keep looking at the camera');

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

  // Transition from live -> auto-capturing when face is ready
  useEffect(() => {
    if (phase === 'live' && liveStatus.status === 'ready') {
      // Auto-start capturing when one face is detected
      setPhase('auto-capturing');
    }
  }, [phase, liveStatus.status]);

  // Auto-capturing loop
  useEffect(() => {
    let interval;
    if (phase === 'auto-capturing') {
      interval = setInterval(() => {
        // Pause capturing if no face or multiple faces
        if (liveStatus.status !== 'ready') return;

        setCapturedImages(prev => {
          if (prev.length >= MAX_FRAMES) return prev;
          
          const frameData = captureFrame();
          if (frameData && frameData.b64) {
             return [...prev, frameData.b64];
          }
          return prev;
        });
      }, CAPTURE_INTERVAL_MS);
    }
    return () => clearInterval(interval);
  }, [phase, liveStatus.status, captureFrame]);

  // Dynamic Instructions & Submission
  useEffect(() => {
    if (phase === 'auto-capturing') {
      const len = capturedImages.length;
      if (len >= MAX_FRAMES) {
        setPhase('submitting');
        studentService.registerFace(capturedImages)
          .then(res => {
            const data = res.data;
            if (data.success === false) {
              setServerError(data.message || 'Registration failed');
              setPhase('error');
            } else {
              setServerMsg(data.message || 'Face registered successfully');
              setPhase('done');
              stopCamera();
            }
          })
          .catch(err => {
            const d = err.response?.data?.detail;
            const msg = (typeof d === 'object' ? d?.message : d) || 'Registration failed. Please try again.';
            setServerError(msg);
            setPhase('error');
          });
      } else {
        // Provide diverse pose instructions during capture
        const progress = len / MAX_FRAMES;
        if (progress < 0.2) setCaptureInstruction('Keep looking straight');
        else if (progress < 0.4) setCaptureInstruction('Turn slightly Left');
        else if (progress < 0.6) setCaptureInstruction('Turn slightly Right');
        else if (progress < 0.8) setCaptureInstruction('Look slightly Up');
        else setCaptureInstruction('Look slightly Down');
      }
    }
  }, [capturedImages.length, phase, capturedImages, stopCamera]);

  const handleRetryError = useCallback(() => {
    setServerError('');
    setCapturedImages([]);
    setPhase('live');
  }, []);

  const isLive = phase === 'live';
  const isAutoCap = phase === 'auto-capturing';
  const isSubmitting = phase === 'submitting';
  const isDone = phase === 'done';
  const isError = phase === 'error';

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 800, background: 'linear-gradient(to right, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Automatic Face Registration
      </Typography>
      <Typography color="textSecondary" variant="subtitle1" sx={{ mb: 3 }}>
        The system will automatically collect optimal face samples without requiring any button presses.
      </Typography>

      <Grid container spacing={3} justifyContent="center">
        <Grid item xs={12} md={7}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>

              {/* Viewport */}
              <Box sx={{ position: 'relative', width: '100%', maxWidth: 520, margin: '0 auto', aspectRatio: '4/3', borderRadius: '12px', bgcolor: '#0a0a0a', overflow: 'hidden' }}>
                
                {/* Live Video */}
                {(isLive || isAutoCap || isSubmitting || isError || isDone) && stream ? (
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
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', display: (isLive || isAutoCap) ? 'block' : 'none' }} />

                {/* Auto Capturing Overlay */}
                {isAutoCap && (
                  <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, bgcolor: 'rgba(0,0,0,0.7)', p: 2, color: 'white' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{captureInstruction}</Typography>
                    <LinearProgress variant="determinate" value={(capturedImages.length / MAX_FRAMES) * 100} sx={{ height: 10, borderRadius: 5 }} />
                    <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                      Collected {capturedImages.length} of {MAX_FRAMES} samples
                    </Typography>
                  </Box>
                )}

                {/* Submitting overlay */}
                {isSubmitting && (
                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.7)', gap: 2 }}>
                    <CircularProgress size={52} sx={{ color: '#22c55e' }} />
                    <Typography sx={{ color: '#fff', fontWeight: 700 }}>Processing multiple face samples...</Typography>
                  </Box>
                )}
              </Box>

              {/* Hidden canvas for poller */}
              <canvas ref={captureCanvasRef} style={{ display: 'none' }} />

              {/* Live Status Messaging */}
              {(isLive || isAutoCap) && (
                <Box sx={{ mt: 2.5 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: liveStatus.color, transition: 'color 0.3s ease' }}>
                    {liveStatus.message || 'Position your face inside the frame.'}
                  </Typography>
                </Box>
              )}

              {/* Success */}
              {isDone && (
                <Box sx={{ mt: 2.5, p: 2.5, borderRadius: '12px', bgcolor: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.22)', textAlign: 'center' }}>
                  <CheckCircle sx={{ color: '#22c55e', fontSize: 48, mb: 1 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#22c55e' }}>{serverMsg}</Typography>
                  <Box sx={{ mt: 2 }}>
                    <Button variant="contained" size="small" onClick={() => navigate('/student/dashboard')}
                      sx={{ borderRadius: '8px', textTransform: 'none' }}>
                      Go to Dashboard
                    </Button>
                  </Box>
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

        {/* Tips panel */}
        <Grid item xs={12} md={5}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.07)', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2.5 }}>Registration Tips</Typography>
              <Alert severity="info" sx={{ mb: 3, borderRadius: '12px' }}>
                You do not need to press any capture button. Just move your head as instructed.
              </Alert>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  { icon: '🔄', tip: 'Slowly follow the on-screen instructions (turn left/right/up/down).' },
                  { icon: '💡', tip: 'Ensure your face is well lit.' },
                  { icon: '🧍', tip: 'Ensure no one else is in the frame.' },
                  { icon: '🚫', tip: 'Remove glasses, masks, or hats if possible.' },
                ].map(({ icon, tip }) => (
                  <Box key={tip} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '1.3rem' }}>{icon}</Typography>
                    <Typography variant="body2" color="textSecondary">{tip}</Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
