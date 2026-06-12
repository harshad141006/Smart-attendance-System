import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Tabs, Tab, Alert, CircularProgress } from '@mui/material';
import { userService, authService, facultyService } from '../../services';
import { Add, Delete, Edit, Person, Wifi } from '@mui/icons-material';

const ManageUsers = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Dialog Controls
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form States
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'student'
  });
  
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    profile_picture: ''
  });

  const [hotspotOpen, setHotspotOpen] = useState(false);
  const [hotspotForm, setHotspotForm] = useState({
    ssid: '',
    bssid: ''
  });

  const loadUsers = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await userService.list();
      setUsers(res.data || []);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load system users list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleOpenCreate = () => {
    setCreateForm({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      role: 'student'
    });
    setCreateOpen(true);
  };

  const handleCloseCreate = () => {
    setCreateOpen(false);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await authService.register(createForm);
      setSuccessMsg('User registered successfully.');
      handleCloseCreate();
      loadUsers();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to register new user.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (user) => {
    setSelectedUser(user);
    setEditForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone_number: user.phone_number || '',
      profile_picture: user.profile_picture || ''
    });
    setEditOpen(true);
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setSelectedUser(null);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await userService.update(selectedUser.id || selectedUser._id, editForm);
      setSuccessMsg('User updated successfully.');
      handleCloseEdit();
      loadUsers();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to update user.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenHotspot = (user) => {
    setSelectedUser(user);
    setHotspotForm({ ssid: '', bssid: '' }); // Reset or load existing if we had them in user object
    setHotspotOpen(true);
  };

  const handleCloseHotspot = () => {
    setHotspotOpen(false);
    setSelectedUser(null);
  };

  const handleHotspotSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await facultyService.updateHotspotConfig(selectedUser.id || selectedUser._id, hotspotForm.ssid, hotspotForm.bssid);
      setSuccessMsg('Faculty hotspot configured successfully.');
      handleCloseHotspot();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to configure faculty hotspot.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user and all associated records? This cannot be undone.')) {
      return;
    }
    
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await userService.delete(userId);
      setSuccessMsg('User deleted successfully.');
      loadUsers();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to delete user.');
    }
  };

  // Filter users by role
  const roleFilters = ['student', 'faculty', 'advisor', 'admin'];
  const filteredUsers = users.filter(u => u.role === roleFilters[tabIndex]);

  if (loading && users.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, background: 'linear-gradient(to right, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            User Account Management
          </Typography>
          <Typography color="textSecondary" variant="subtitle1">
            Create user accounts, modify profile values, and delete credentials.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpenCreate}
          sx={{ borderRadius: '12px', px: 3, py: 1.2, textTransform: 'none', fontWeight: 'bold', backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        >
          Add New User
        </Button>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{errorMsg}</Alert>}

      <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabIndex} onChange={(e, index) => setTabIndex(index)} sx={{ px: 2 }}>
            <Tab label="Students" sx={{ textTransform: 'none', fontWeight: 'bold' }} />
            <Tab label="Faculty" sx={{ textTransform: 'none', fontWeight: 'bold' }} />
            <Tab label="Advisors" sx={{ textTransform: 'none', fontWeight: 'bold' }} />
            <Tab label="Admins" sx={{ textTransform: 'none', fontWeight: 'bold' }} />
          </Tabs>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Email Address</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Role Type</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No users found for this role category.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((row) => (
                  <TableRow key={row.id || row._id} sx={{ '&:hover': { bgcolor: '#f7fafc' } }}>
                    <TableCell sx={{ fontWeight: '500' }}>
                      {row.first_name} {row.last_name}
                    </TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>
                      <Chip label={row.role.toUpperCase()} size="small" variant="outlined" color="primary" sx={{ fontWeight: 'bold' }} />
                    </TableCell>
                    <TableCell>
                      <Chip label={row.is_active ? 'ACTIVE' : 'INACTIVE'} size="small" color={row.is_active ? 'success' : 'default'} sx={{ fontWeight: 'bold' }} />
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                        {row.role === 'faculty' && (
                          <IconButton color="warning" onClick={() => handleOpenHotspot(row)} size="small" title="Manage Hotspot">
                            <Wifi />
                          </IconButton>
                        )}
                        <IconButton color="primary" onClick={() => handleOpenEdit(row)} size="small">
                          <Edit />
                        </IconButton>
                        <IconButton color="error" onClick={() => handleDeleteUser(row.id || row._id)} size="small">
                          <Delete />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={createOpen} onClose={handleCloseCreate} maxWidth="xs" fullWidth PaperProps={{ style: { borderRadius: '16px' } }}>
        <form onSubmit={handleCreateSubmit}>
          <DialogTitle sx={{ fontWeight: 'bold' }}>Create User Account</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="First Name"
                value={createForm.first_name}
                onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Last Name"
                value={createForm.last_name}
                onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
                required
                fullWidth
              />
              <TextField
                type="email"
                label="Email Address"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                required
                fullWidth
              />
              <TextField
                type="password"
                label="Password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                required
                fullWidth
              />
              <TextField
                select
                label="Select Account Role"
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                required
                fullWidth
              >
                <MenuItem value="student">Student</MenuItem>
                <MenuItem value="faculty">Faculty</MenuItem>
                <MenuItem value="advisor">Advisor</MenuItem>
                <MenuItem value="admin">Administrator</MenuItem>
              </TextField>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleCloseCreate} variant="outlined" sx={{ borderRadius: '8px' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
              sx={{ borderRadius: '8px', fontWeight: 'bold' }}
            >
              {submitting ? 'Creating...' : 'Register User'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onClose={handleCloseEdit} maxWidth="xs" fullWidth PaperProps={{ style: { borderRadius: '16px' } }}>
        <form onSubmit={handleEditSubmit}>
          <DialogTitle sx={{ fontWeight: 'bold' }}>Edit Profile: {selectedUser?.email}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="First Name"
                value={editForm.first_name}
                onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Last Name"
                value={editForm.last_name}
                onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Phone Number"
                value={editForm.phone_number}
                onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleCloseEdit} variant="outlined" sx={{ borderRadius: '8px' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
              sx={{ borderRadius: '8px', fontWeight: 'bold' }}
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Hotspot Dialog */}
      <Dialog open={hotspotOpen} onClose={handleCloseHotspot} maxWidth="xs" fullWidth PaperProps={{ style: { borderRadius: '16px' } }}>
        <form onSubmit={handleHotspotSubmit}>
          <DialogTitle sx={{ fontWeight: 'bold' }}>Faculty Hotspot Config: {selectedUser?.first_name}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Configure the Wi-Fi hotspot details for this faculty member. Students will connect to this during power cuts.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Hotspot SSID (Network Name)"
                value={hotspotForm.ssid}
                onChange={(e) => setHotspotForm({ ...hotspotForm, ssid: e.target.value })}
                required
                fullWidth
                placeholder="e.g. DrSmith_Class_Hotspot"
              />
              <TextField
                label="Hotspot BSSID (MAC Address)"
                value={hotspotForm.bssid}
                onChange={(e) => setHotspotForm({ ...hotspotForm, bssid: e.target.value })}
                required
                fullWidth
                placeholder="e.g. 1A:2B:3C:4D:5E:6F"
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleCloseHotspot} variant="outlined" sx={{ borderRadius: '8px' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              color="warning"
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Wifi />}
              sx={{ borderRadius: '8px', fontWeight: 'bold' }}
            >
              {submitting ? 'Saving...' : 'Update Hotspot'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ManageUsers;
