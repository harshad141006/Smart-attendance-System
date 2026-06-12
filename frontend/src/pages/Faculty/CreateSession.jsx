import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, TextField, Button, Grid, MenuItem, Alert, CircularProgress, Switch, FormControlLabel, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth, useGeolocation } from '../../hooks';
import { facultyService, subjectService } from '../../services';
import { MyLocation, PlayArrow } from '@mui/icons-material';

const CreateSession = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Geolocation hook
  const { location, error: geoError, loading: geoLoading, getLocation } = useGeolocation();
  
  // Form states
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [form, setForm] = useState({
    subject_id: '',
    session_title: '',
    duration_minutes: 15,
    latitude: 28.7041,  // Default fallback coords
    longitude: 77.1025,
    radius_meters: 100,
    allow_faculty_hotspot: false
  });

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setLoading(true);
        // We fetch subjects. Usually, subjects are queried by faculty ID.
        // For testing/mocking, if there is no faculty_id record, we list all subjects.
        const subRes = await subjectService.list();
        setSubjects(subRes.data || []);
      } catch (err) {
        console.error(err);
        setErrorMsg('Failed to load subjects.');
      } finally {
        setLoading(false);
      }
    };
    fetchSubjects();
  }, [user]);

  const handleLocateMe = async () => {
    setErrorMsg('');
    const pos = await getLocation();
    if (pos) {
      setForm((prev) => ({
        ...prev,
        latitude: pos.latitude,
        longitude: pos.longitude
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject_id) {
      setErrorMsg('Please select a subject.');
      return;
    }
    
    setCreating(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      // Create session
      const createRes = await facultyService.createSession(
        form.subject_id,
        form.session_title || 'Regular Lecture',
        form.duration_minutes,
        form.latitude,
        form.longitude,
        form.radius_meters,
        form.allow_faculty_hotspot
      );
      
      const sessId = createRes.data.session_id;
      
      // Automatically start session
      await facultyService.startSession(sessId);
      
      setSuccessMsg('Attendance session started successfully!');
      // Navigate to live attendance panel
      setTimeout(() => {
        navigate('/faculty/live-attendance');
      }, 1000);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to start attendance session.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: '800px', margin: '0 auto' }}>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 800, background: 'linear-gradient(to right, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Create Attendance Session
      </Typography>
      <Typography color="textSecondary" variant="subtitle1" sx={{ mb: 4 }}>
        Configure a geofenced marking window for your students.
      </Typography>

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{errorMsg}</Alert>}
      {geoError && <Alert severity="warning" sx={{ mb: 3, borderRadius: '12px' }}>GPS Location Error: {geoError}</Alert>}

      <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: 4 }}>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label="Select Subject"
                  value={form.subject_id}
                  onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                  required
                >
                  {subjects.length === 0 ? (
                    <MenuItem value="">No subjects found</MenuItem>
                  ) : (
                    subjects.map((sub) => (
                      <MenuItem key={sub.id} value={sub.id}>
                        {sub.code} - {sub.name} (Sem {sub.semester})
                      </MenuItem>
                    ))
                  )}
                </TextField>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Session Title / Topic"
                  placeholder="e.g. Lecture 4: Tree Traversals"
                  value={form.session_title}
                  onChange={(e) => setForm({ ...form, session_title: e.target.value })}
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Duration (Minutes)"
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 15 })}
                  required
                  inputProps={{ min: 5, max: 180 }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Geofence Radius (Meters)"
                  value={form.radius_meters}
                  onChange={(e) => setForm({ ...form, radius_meters: parseInt(e.target.value) || 100 })}
                  required
                  inputProps={{ min: 10, max: 2000 }}
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.allow_faculty_hotspot}
                      onChange={(e) => setForm({ ...form, allow_faculty_hotspot: e.target.checked })}
                      color="primary"
                    />
                  }
                  label={
                    <Typography variant="body1">
                      Allow Faculty Hotspot <b>(Power Cut Fallback)</b>
                    </Typography>
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2 }}>
                  Validation Location Coordinates
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Latitude"
                      value={form.latitude}
                      onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) || 0 })}
                      required
                      inputProps={{ step: 'any' }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Longitude"
                      value={form.longitude}
                      onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) || 0 })}
                      required
                      inputProps={{ step: 'any' }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={geoLoading ? <CircularProgress size={18} /> : <MyLocation />}
                      onClick={handleLocateMe}
                      disabled={geoLoading}
                      sx={{ py: 1.5, borderRadius: '8px', textTransform: 'none' }}
                    >
                      {geoLoading ? 'Locating...' : 'Get GPS Coords'}
                    </Button>
                  </Grid>
                </Grid>
              </Grid>

              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  startIcon={creating ? <CircularProgress size={20} color="inherit" /> : <PlayArrow />}
                  disabled={creating}
                  sx={{ py: 1.5, borderRadius: '10px', textTransform: 'none', fontWeight: 'bold', fontSize: '1rem', backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                >
                  {creating ? 'Starting Session...' : 'Start Session & Open Marking Window'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CreateSession;
