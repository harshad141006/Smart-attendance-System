import React, { useState, useRef, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Button, Grid, IconButton, Alert, CircularProgress, Tabs, Tab } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useAuth } from '../../hooks';
import axios from 'axios';

const FaceDetectionTest = () => {
  const { token } = useAuth(); // token for authenticated requests if needed
  const [images, setImages] = useState([]);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // start webcam when Capture tab is active
  useEffect(() => {
    if (tab === 0) {
      (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (e) {
          console.error('Camera error', e);
        }
      })();
    }
  }, [tab]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');
    setImages(prev => [...prev, dataUrl]);
  };

  const handleFileUpload = (e) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        if (ev.target?.result) {
          setImages(prev => [...prev, ev.target.result]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const submitDetection = async () => {
    if (images.length === 0) return;
    setLoading(true);
    try {
      const payload = { images };
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const { data } = await axios.post('/api/v1/students/face-detect', payload, config);
      const map = {};
      data.results.forEach((r) => {
        map[r.index] = r.detected;
      });
      setResults(map);
    } catch (e) {
      console.error('Detection error', e);
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setImages([]);
    setResults({});
  };

  return (
    <Box sx={{ p: 3, minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Card sx={{ maxWidth: 900, mx: 'auto', p: 3, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)' }}>
        <CardContent>
          <Typography variant="h4" component="h1" sx={{ mb: 2, textAlign: 'center', fontWeight: 'bold' }}>
            Face Detection Tester
          </Typography>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} centered sx={{ mb: 2 }}>
            <Tab label="Capture" />
            <Tab label="Upload" />
          </Tabs>
          {tab === 0 && (
            <Box sx={{ textAlign: 'center' }}>
              <video ref={videoRef} autoPlay playsInline style={{ maxWidth: '100%', borderRadius: 8 }} />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <Button variant="contained" color="primary" onClick={handleCapture} sx={{ mt: 2, background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
                Capture Frame
              </Button>
            </Box>
          )}
          {tab === 1 && (
            <Box sx={{ textAlign: 'center' }}>
              <Button variant="contained" component="label" sx={{ mt: 2, background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
                Choose Files
                <input hidden multiple type="file" accept="image/*" onChange={handleFileUpload} />
              </Button>
            </Box>
          )}
          {images.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Grid container spacing={2}>
                {images.map((src, idx) => (
                  <Grid item xs={4} md={3} key={idx}>
                    <Box className="thumbnail" sx={{ position: 'relative' }}>
                      <img src={src} alt={`img-${idx}`} style={{ width: '100%', borderRadius: 4 }} />
                      {results[idx] !== undefined && (
                        <Box className="status" sx={{ position: 'absolute', top: 4, right: 4, color: '#fff' }}>
                          {results[idx] ? (
                            <CheckCircleIcon color="success" />
                          ) : (
                            <CancelIcon color="error" />
                          )}
                        </Box>
                      )}
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button variant="contained" onClick={submitDetection} disabled={loading || images.length === 0} sx={{ mr: 2, background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Run Detection'}
            </Button>
            <Button variant="outlined" onClick={clearAll} disabled={loading}>
              Clear All
            </Button>
          </Box>
          {Object.keys(results).length > 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Detection completed. Green ✓ means face detected, red ✗ means none.
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default FaceDetectionTest;
