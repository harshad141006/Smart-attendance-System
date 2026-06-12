import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  TextField,
  Button,
  Alert,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  OutlinedInput,
  Checkbox,
  ListItemText
} from '@mui/material';
import { useAuth } from '../hooks';
import { extractErrorMessage } from '../utils';
import { subjectService } from '../services';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, loading, error } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [fetchingSubjects, setFetchingSubjects] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student',
    hotspotSSID: '',
    hotspotBSSID: '',
    assignedSubjects: [],
  });

  useEffect(() => {
    const fetchSubjects = async () => {
      if (formData.role === 'faculty' && subjects.length === 0) {
        setFetchingSubjects(true);
        try {
          const res = await subjectService.list();
          setSubjects(Array.isArray(res.data) ? res.data : (res.data?.subjects || []));
        } catch (err) {
          console.error("Failed to load subjects", err);
        } finally {
          setFetchingSubjects(false);
        }
      }
    };
    fetchSubjects();
  }, [formData.role]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    const success = await register(
      formData.email,
      formData.password,
      formData.firstName,
      formData.lastName,
      formData.role,
      formData.role === 'faculty' ? formData.hotspotSSID : null,
      formData.role === 'faculty' ? formData.hotspotBSSID : null,
      formData.role === 'faculty' ? formData.assignedSubjects : []
    );

    if (success) {
      navigate('/login');
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Container maxWidth="sm">
        <Card sx={{ p: 4, boxShadow: 4 }}>
          <CardContent>
            <Typography variant="h4" component="h1" sx={{ mb: 3, textAlign: 'center', fontWeight: 'bold' }}>
              Register
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{extractErrorMessage(error)}</Alert>}

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
              <TextField
                fullWidth
                label="First Name"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                margin="normal"
                required
              />

              <TextField
                fullWidth
                label="Last Name"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                margin="normal"
                required
              />

              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                margin="normal"
                required
              />

              <TextField
                fullWidth
                label="Password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                margin="normal"
                required
              />

              <TextField
                fullWidth
                label="Confirm Password"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                margin="normal"
                required
              />

              <FormControl fullWidth margin="normal">
                <InputLabel>Role</InputLabel>
                <Select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  label="Role"
                >
                  <MenuItem value="student">Student</MenuItem>
                  <MenuItem value="faculty">Faculty</MenuItem>
                  <MenuItem value="advisor">Advisor</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>

              {formData.role === 'faculty' && (
                <Box sx={{ mt: 2, p: 2, bgcolor: '#f7fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: '#4a5568' }}>
                    Faculty Configuration
                  </Typography>
                  <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 2 }}>
                    Assign subjects and configure hotspot details.
                  </Typography>
                  
                  <FormControl fullWidth margin="dense" size="small">
                    <InputLabel id="subjects-label">Assigned Subjects (Optional)</InputLabel>
                    <Select
                      labelId="subjects-label"
                      multiple
                      name="assignedSubjects"
                      value={formData.assignedSubjects}
                      onChange={handleChange}
                      input={<OutlinedInput label="Assigned Subjects (Optional)" />}
                      renderValue={(selected) => selected.map(id => {
                        const sub = subjects.find(s => s.id === id || s._id === id);
                        return sub ? sub.code : id;
                      }).join(', ')}
                    >
                      {fetchingSubjects ? (
                        <MenuItem disabled><CircularProgress size={20} sx={{ mr: 1 }}/> Loading subjects...</MenuItem>
                      ) : (
                        subjects.map((sub) => (
                          <MenuItem key={sub.id || sub._id} value={sub.id || sub._id}>
                            <Checkbox checked={formData.assignedSubjects.indexOf(sub.id || sub._id) > -1} />
                            <ListItemText primary={`${sub.code} - ${sub.name}`} />
                          </MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>

                  <TextField
                    fullWidth
                    label="Hotspot SSID (Network Name)"
                    name="hotspotSSID"
                    value={formData.hotspotSSID}
                    onChange={handleChange}
                    margin="dense"
                    size="small"
                  />
                  <TextField
                    fullWidth
                    label="Hotspot BSSID (MAC Address)"
                    name="hotspotBSSID"
                    value={formData.hotspotBSSID}
                    onChange={handleChange}
                    margin="dense"
                    size="small"
                    placeholder="e.g. 00:11:22:33:44:55"
                  />
                </Box>
              )}

              <Button
                fullWidth
                type="submit"
                variant="contained"
                color="primary"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Register'}
              </Button>

              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2">
                  Already have an account?{' '}
                  <Button color="primary" onClick={() => navigate('/login')} sx={{ p: 0 }}>
                    Login here
                  </Button>
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default RegisterPage;
