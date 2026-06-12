import React, { useRef, useState, useEffect } from 'react';
import { Box, Card, CardContent, Button, Typography, Alert, CircularProgress, Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useCamera } from '../../hooks';
import { studentService } from '../../services';
import { CameraAlt, PhotoCamera, CheckCircle } from '@mui/icons-material';

const POSES = [
  'Look straight (neutral)',
  'Turn left slightly',
  'Turn right slightly',
  'Smile',
  'Tilt head left',
  'Tilt head right',
  'Look up',
  'Look down'
];

const FaceRegistration = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [registered, setRegistered] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [capturedImages, setCapturedImages] = useState([]);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);

  const { startCamera, stopCamera, stream, error: cameraError } = useCamera();

  // Stop camera on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (stream && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleStartCamera = async () => {
    setErrorMsg('');
    setMessage('');
    setCapturedImages([]);
    setCurrentPoseIndex(0);
    const s = await startCamera(videoRef.current);
    if (s) {
      setMessage(`Camera initialized. Pose 1/${POSES.length}: ${POSES[0]}`);
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current || !stream) {
      setErrorMsg('Camera stream not active');
      return;
    }

    setErrorMsg('');
    setMessage('');

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.9);
      
      const newCapturedImages = [...capturedImages, base64Image];
      setCapturedImages(newCapturedImages);

      if (currentPoseIndex < POSES.length - 1) {
        setCurrentPoseIndex(prev => prev + 1);
        setMessage(`Pose captured! Next: ${POSES[currentPoseIndex + 1]}`);
      } else {
        // All poses captured, send to backend
        setLoading(true);
        setMessage('All poses captured. Registering face model...');
        const response = await studentService.registerFace(newCapturedImages);
        
        setMessage(response.data.message || 'Face registered successfully!');
        setRegistered(true);
        stopCamera();
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to analyze and register face embedding. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 800, background: 'linear-gradient(to right, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        AI Face Registration
      </Typography>
      <Typography color="textSecondary" variant="subtitle1" sx={{ mb: 4 }}>
        Securely register your face biometrics. Raw photos are not stored on our servers.
      </Typography>

      {message && <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }}>{message}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{errorMsg}</Alert>}
      {cameraError && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>Camera Access Error: {cameraError}</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <Box sx={{ position: 'relative', width: '100%', maxWidth: '480px', margin: '0 auto', aspectRatio: '4/3', borderRadius: '12px', bgcolor: '#000', overflow: 'hidden', border: '2px solid #e2e8f0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {stream ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Box sx={{ color: '#a0aec0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <PhotoCamera sx={{ fontSize: 48 }} />
                    <Typography variant="body2">Camera is currently inactive</Typography>
                  </Box>
                )}
                
                {/* Visual Face Oval Overlay */}
                {stream && (
                  <Box sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '60%',
                    height: '75%',
                    border: '3px dashed #667eea',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)'
                  }} />
                )}
              </Box>

              {/* Hidden canvas for grabbing frames */}
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: 2 }}>
                {!stream ? (
                  <Button
                    variant="contained"
                    startIcon={<CameraAlt />}
                    onClick={handleStartCamera}
                    sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 'bold', px: 3, py: 1.2 }}
                  >
                    Start Camera
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => stopCamera()}
                      sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 'bold', px: 3 }}
                    >
                      Stop Camera
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PhotoCamera />}
                      onClick={handleCapture}
                      disabled={loading}
                      sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 'bold', px: 3, py: 1.2 }}
                    >
                      {loading ? 'Processing...' : 'Capture & Register'}
                    </Button>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)', height: '100%' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                Verification Guidelines
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                  <CheckCircle sx={{ color: 'success.main', mr: 2, mt: 0.5 }} />
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>Lighting Condition</Typography>
                    <Typography variant="body2" color="textSecondary">Ensure you are in a well-lit room. Avoid backlighting or strong direct sun on the camera lens.</Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                  <CheckCircle sx={{ color: 'success.main', mr: 2, mt: 0.5 }} />
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>Neutral Pose</Typography>
                    <Typography variant="body2" color="textSecondary">Position your head within the overlay frame. Face directly forward and maintain a neutral expression.</Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                  <CheckCircle sx={{ color: 'success.main', mr: 2, mt: 0.5 }} />
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>No Obstruction</Typography>
                    <Typography variant="body2" color="textSecondary">Remove sunglasses, caps, masks or heavy headwear that covers structural facial attributes.</Typography>
                  </Box>
                </Box>
              </Box>

              {registered && (
                <Box sx={{ mt: 5, p: 3, borderRadius: '12px', bgcolor: 'rgba(76, 175, 80, 0.08)', border: '1px solid rgba(76, 175, 80, 0.2)', textAlign: 'center' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'success.main', mb: 1 }}>
                    Biometric Face ID Active
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Your facial parameters are registered. You can now mark attendance using the mobile verify screen.
                  </Typography>
                  <Button variant="contained" size="small" onClick={() => navigate('/student/dashboard')} sx={{ borderRadius: '8px', textTransform: 'none' }}>
                    Go to Dashboard
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default FaceRegistration;
