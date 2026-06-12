import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Alert,
  CircularProgress,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Videocam,
  Stop,
  CheckCircle,
  Cancel,
  Replay,
  Upload,
  Lock,
} from '@mui/icons-material';
import { studentService } from '../../services';

const FaceVideoDetection = () => {
  const [cameraActive, setCameraActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoBlob, setVideoBlob] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const initCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      const constraints = {
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = s;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
      setCameraError(null);
    } catch (err) {
      console.error('Error opening webcam:', err);
      setCameraError('Could not access webcam. Please check permissions.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    initCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    
    let options = {};
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      options = { mimeType: 'video/webm;codecs=vp8' };
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      options = { mimeType: 'video/webm' };
    }

    try {
      const recorder = new MediaRecorder(streamRef.current, options);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        setVideoBlob(blob);
        setVideoUrl(url);
        setRecording(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordingTime(12);
      setVideoUrl(null);
      setVideoBlob(null);
      setVerificationResult(null);
      setErrorMsg('');
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

  const handleVerify = async () => {
    if (!videoBlob) return;
    setLoading(true);
    setErrorMsg('');
    setVerificationResult(null);

    try {
      const response = await studentService.detectFaceVideo(videoBlob);
      setVerificationResult(response.data);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Verification failed. Please try again with a better angle.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetake = () => {
    setVideoBlob(null);
    setVideoUrl(null);
    setVerificationResult(null);
    setErrorMsg('');
    initCamera();
  };

  return (
    <Box sx={{ p: 1, minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card sx={{
        width: '100%',
        maxWidth: 850,
        borderRadius: '24px',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        overflow: 'hidden'
      }}>
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Typography variant="h4" sx={{
            mb: 1,
            fontWeight: 800,
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textAlign: 'center'
          }}>
            Video Biometric Verification
          </Typography>
          <Typography color="textSecondary" variant="subtitle1" sx={{ mb: 4, textAlign: 'center' }}>
            Record a short 12-second clip. Our AI will automatically select the best frame to match against your profile picture.
          </Typography>

          {cameraError && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{cameraError}</Alert>}
          {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{errorMsg}</Alert>}

          <Grid container spacing={4}>
            {/* Left side: Camera / Preview */}
            <Grid item xs={12} md={7}>
              <Box sx={{
                position: 'relative',
                width: '100%',
                aspectRatio: '4/3',
                borderRadius: '16px',
                bgcolor: '#0f172a',
                overflow: 'hidden',
                border: '2px solid rgba(79, 70, 229, 0.2)',
                boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                {videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'scaleX(-1)' // Mirror view for webcam
                    }}
                  />
                )}

                {/* Oval overlay for recording */}
                {!videoUrl && cameraActive && (
                  <Box sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '60%',
                    height: '75%',
                    border: recording ? '3px solid #ef4444' : '3px dashed #4f46e5',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                    boxShadow: recording ? '0 0 15px rgba(239, 68, 68, 0.5)' : '0 0 15px rgba(79, 70, 229, 0.3)',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {recording && (
                      <Typography sx={{
                        color: '#ef4444',
                        bgcolor: 'rgba(0,0,0,0.7)',
                        px: 2,
                        py: 0.5,
                        borderRadius: '20px',
                        fontSize: '0.875rem',
                        fontWeight: 'bold',
                        animation: 'pulse 1s infinite'
                      }}>
                        REC {recordingTime}s
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>

              {/* Progress Bar for recording */}
              {recording && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={(recordingTime / 12) * 100}
                    color="error"
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>
              )}

              {/* Action Buttons */}
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 2 }}>
                {!videoUrl ? (
                  recording ? (
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={<Stop />}
                      onClick={stopRecording}
                      sx={{ borderRadius: '12px', px: 4, py: 1.2, fontWeight: 'bold' }}
                    >
                      Stop Recording
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<Videocam />}
                      onClick={startRecording}
                      disabled={!cameraActive}
                      sx={{
                        borderRadius: '12px',
                        px: 4,
                        py: 1.2,
                        fontWeight: 'bold',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                      }}
                    >
                      Start Recording (12s Max)
                    </Button>
                  )
                ) : (
                  <>
                    <Button
                      variant="outlined"
                      color="primary"
                      startIcon={<Replay />}
                      onClick={handleRetake}
                      disabled={loading}
                      sx={{ borderRadius: '12px', px: 3, fontWeight: 'bold' }}
                    >
                      Retake Video
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Upload />}
                      onClick={handleVerify}
                      disabled={loading || !videoBlob}
                      sx={{
                        borderRadius: '12px',
                        px: 4,
                        fontWeight: 'bold',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      {loading ? 'Analyzing...' : 'Verify with Photo'}
                    </Button>
                  </>
                )}
              </Box>
            </Grid>

            {/* Right side: Instructions / Verification Results */}
            <Grid item xs={12} md={5} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {!verificationResult && !loading && (
                <Box sx={{ p: 2, bgcolor: 'rgba(79, 70, 229, 0.04)', borderRadius: '16px', border: '1px solid rgba(79, 70, 229, 0.08)' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#4f46e5', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Lock fontSize="small" /> Guidelines for Success
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1.5, color: '#4b5563' }}>
                    • Look directly into the camera.
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1.5, color: '#4b5563' }}>
                    • Slowly move or tilt your head slightly so the AI can capture different angles.
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1.5, color: '#4b5563' }}>
                    • Make sure you have good lighting on your face.
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#4b5563' }}>
                    • Keep head wear, sunglasses, and masks removed.
                  </Typography>
                </Box>
              )}

              {loading && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress size={60} thickness={4.5} sx={{ color: '#4f46e5', mb: 3 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#1f2937', mb: 1 }}>
                    Processing Clip
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Extracting frames, running face detection, and performing L2 vector comparison against your registered profile...
                  </Typography>
                </Box>
              )}

              {verificationResult && (
                <Box>
                  <Card sx={{
                    borderRadius: '16px',
                    border: '1px solid',
                    borderColor: verificationResult.verified ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    bgcolor: verificationResult.verified ? 'rgba(16, 185, 129, 0.04)' : 'rgba(239, 68, 68, 0.04)',
                    boxShadow: 'none',
                    p: 3,
                    textAlign: 'center'
                  }}>
                    {verificationResult.verified ? (
                      <>
                        <CheckCircle sx={{ fontSize: 60, color: '#10b981', mb: 2 }} />
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#065f46', mb: 1 }}>
                          Match Verified!
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                          Your live video successfully matches the registered faceprint on file.
                        </Typography>
                      </>
                    ) : (
                      <>
                        <Cancel sx={{ fontSize: 60, color: '#ef4444', mb: 2 }} />
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#991b1b', mb: 1 }}>
                          Verification Failed
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                          The live video did not match the registered faceprint or no valid face was found in the video.
                        </Typography>
                      </>
                    )}
                  </Card>

                  <Typography variant="subtitle2" sx={{ mt: 3, mb: 1, fontWeight: 'bold' }}>
                    Video Frame Diagnostics
                  </Typography>
                  <Box sx={{
                    maxHeight: 180,
                    overflowY: 'auto',
                    border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: '12px',
                    bgcolor: 'white'
                  }}>
                    <List size="small" disablePadding>
                      {verificationResult.results?.map((frame, index) => (
                        <ListItem key={index} sx={{ borderBottom: '1px solid #f3f4f6' }}>
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            {frame.detected ? (
                              <CheckCircle fontSize="small" sx={{ color: '#10b981' }} />
                            ) : (
                              <Cancel fontSize="small" sx={{ color: '#ef4444' }} />
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={`Frame ${index + 1} (${index}s)`}
                            secondary={frame.detected ? "Face detected successfully" : "No face detected"}
                            primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 600 }}
                            secondaryTypographyProps={{ fontSize: '0.75rem' }}
                          />
                          {verificationResult.best_frame_index === index && (
                            <Typography variant="caption" sx={{
                              bgcolor: 'rgba(79, 70, 229, 0.1)',
                              color: '#4f46e5',
                              px: 1,
                              py: 0.2,
                              borderRadius: '4px',
                              fontWeight: 'bold',
                              fontSize: '0.7rem'
                            }}>
                              Best Frame
                            </Typography>
                          )}
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </Box>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>
    </Box>
  );
};

export default FaceVideoDetection;
