import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, TextField, Button, Grid, Avatar, Divider, Alert, CircularProgress, Tabs, Tab, Chip } from '@mui/material';
import { useAuth } from '../../hooks';
import { authService } from '../../services';
import { Person, Lock, Badge, Wifi } from '@mui/icons-material';
import api from '../../services/api';

const StudentProfile = () => {
  const { user, setUser } = useAuth();
  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Profile state
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    profile_picture: ''
  });
  
  // Password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        if (user) {
          // Use auth/profile endpoint instead of /users/:id
          const res = await api.get('/auth/profile');
          const data = res.data;
          // Backend stores displayName, split it for the form fields
          const nameParts = (data.displayName || '').split(' ');
          setProfile({
            first_name: nameParts[0] || '',
            last_name: nameParts.slice(1).join(' ') || '',
            phone_number: data.phoneNumber || data.phone_number || '',
            profile_picture: data.photoUrl || data.profile_picture || ''
          });
        }
      } catch (err) {
        console.error(err);
        // Fallback: populate from the user object already in state
        if (user) {
          const nameParts = (user.displayName || user.name || '').split(' ');
          setProfile({
            first_name: nameParts[0] || '',
            last_name: nameParts.slice(1).join(' ') || '',
            phone_number: '',
            profile_picture: user.photoUrl || ''
          });
        }
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const displayName = `${profile.first_name} ${profile.last_name}`.trim();
      const res = await api.put('/auth/profile', {
        displayName,
        photoUrl: profile.profile_picture || undefined
      });
      setSuccessMsg('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Failed to update profile.');
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    
    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirm password do not match.');
      return;
    }
    
    try {
      await authService.changePassword(oldPassword, newPassword);
      setSuccessMsg('Password updated successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to change password.');
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
    <Box>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 800, background: 'linear-gradient(to right, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Account Profile
      </Typography>
      <Typography color="textSecondary" variant="subtitle1" sx={{ mb: 4 }}>
        Manage your profile attributes and security configurations.
      </Typography>

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{errorMsg}</Alert>}

      <Grid container spacing={3}>
        {/* Profile Card Sidebar */}
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)', textAlign: 'center', p: 3 }}>
            <CardContent>
              <Avatar
                sx={{
                  width: 100,
                  height: 100,
                  margin: '0 auto 16px',
                  bgcolor: 'primary.main',
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  boxShadow: '0 8px 16px rgba(102, 126, 234, 0.3)'
                }}
              >
                {(user?.displayName || user?.name || '?')[0]}
              </Avatar>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                {profile.first_name} {profile.last_name}
              </Typography>
              <Typography color="textSecondary" variant="body2" sx={{ mb: 3 }}>
                {user?.email}
              </Typography>

              <Chip label={user?.role?.toUpperCase()} color="primary" sx={{ fontWeight: 'bold', mb: 2 }} />
              
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
                <Box>
                  <Typography color="textSecondary" variant="caption">MEMBER SINCE</Typography>
                  <Typography variant="body2" sx={{ fontWeight: '500' }}>
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                  </Typography>
                </Box>
                
                {/* Read-Only WiFi Info */}
                <Box sx={{ bgcolor: '#f7fafc', p: 1.5, borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <Typography color="textSecondary" variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Wifi fontSize="small" /> WIFI INFORMATION
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    Registered Network: College Default
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
                    BSSID: AA:BB:CC:DD:EE:FF
                  </Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1, fontStyle: 'italic', lineHeight: 1.2 }}>
                    *This cannot be edited. During a power cut, you will securely connect to your Faculty's fallback hotspot.
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Profile Tabs Main Area */}
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabIndex} onChange={(e, index) => setTabIndex(index)} sx={{ px: 2 }}>
                <Tab label="Edit Profile" icon={<Person />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 'bold' }} />
                <Tab label="Security & Password" icon={<Lock />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 'bold' }} />
              </Tabs>
            </Box>
            
            <CardContent sx={{ p: 4 }}>
              {tabIndex === 0 && (
                <form onSubmit={handleUpdateProfile}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="First Name"
                        value={profile.first_name}
                        onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                        required
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Last Name"
                        value={profile.last_name}
                        onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                        required
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Phone Number"
                        value={profile.phone_number}
                        onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
                        placeholder="+1 (555) 000-0000"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        type="submit"
                        variant="contained"
                        sx={{ borderRadius: '8px', px: 4, py: 1.2, textTransform: 'none', fontWeight: 'bold' }}
                      >
                        Save Changes
                      </Button>
                    </Grid>
                  </Grid>
                </form>
              )}

              {tabIndex === 1 && (
                <form onSubmit={handleUpdatePassword}>
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        type="password"
                        label="Current Password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        required
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        type="password"
                        label="New Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        type="password"
                        label="Confirm New Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        type="submit"
                        variant="contained"
                        color="secondary"
                        sx={{ borderRadius: '8px', px: 4, py: 1.2, textTransform: 'none', fontWeight: 'bold' }}
                      >
                        Change Password
                      </Button>
                    </Grid>
                  </Grid>
                </form>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default StudentProfile;
