import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tabs, Tab, Alert, CircularProgress, MenuItem } from '@mui/material';
import { departmentService, subjectService, userService } from '../../services';
import { Add, Delete, Edit } from '@mui/icons-material';

const ManageSubjects = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [facultyUsers, setFacultyUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Dialog Controls
  const [deptOpen, setDeptOpen] = useState(false);
  const [subjOpen, setSubjOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form States
  const [deptForm, setDeptForm] = useState({
    name: '',
    code: '',
    hod_id: '',
    contact_email: '',
    contact_phone: ''
  });

  const [subjForm, setSubjForm] = useState({
    code: '',
    name: '',
    description: '',
    credits: 3,
    department_id: '',
    faculty_id: '',
    semester: 1
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      
      const deptsRes = await departmentService.list();
      setDepartments(deptsRes.data || []);

      const subjsRes = await subjectService.list();
      setSubjects(subjsRes.data || []);

      const usersRes = await userService.list();
      setFacultyUsers(usersRes.data.filter(u => u.role === 'faculty' || u.role === 'advisor') || []);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load academic records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenDept = (dept = null) => {
    if (dept) {
      setEditingId(dept.id || dept._id);
      setDeptForm({
        name: dept.name,
        code: dept.code,
        hod_id: dept.hod_id,
        contact_email: dept.contact_email,
        contact_phone: dept.contact_phone
      });
    } else {
      setEditingId(null);
      setDeptForm({
        name: '',
        code: '',
        hod_id: '',
        contact_email: '',
        contact_phone: ''
      });
    }
    setDeptOpen(true);
  };

  const handleCloseDept = () => {
    setDeptOpen(false);
    setEditingId(null);
  };

  const handleDeptSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (editingId) {
        await departmentService.update(editingId, deptForm);
        setSuccessMsg('Department updated successfully.');
      } else {
        await departmentService.create(deptForm);
        setSuccessMsg('Department created successfully.');
      }
      handleCloseDept();
      loadData();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to submit department.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDept = async (id) => {
    if (!window.confirm('Delete this department? This might affect associated courses.')) return;
    try {
      await departmentService.delete(id);
      setSuccessMsg('Department deleted successfully.');
      loadData();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to delete department.');
    }
  };

  const handleOpenSubj = (subj = null) => {
    if (subj) {
      setEditingId(subj.id || subj._id);
      setSubjForm({
        code: subj.code,
        name: subj.name,
        description: subj.description || '',
        credits: subj.credits,
        department_id: subj.department_id,
        faculty_id: subj.faculty_id,
        semester: subj.semester
      });
    } else {
      setEditingId(null);
      setSubjForm({
        code: '',
        name: '',
        description: '',
        credits: 3,
        department_id: departments[0]?.code || '',
        faculty_id: facultyUsers[0]?.id || facultyUsers[0]?._id || '',
        semester: 1
      });
    }
    setSubjOpen(true);
  };

  const handleCloseSubj = () => {
    setSubjOpen(false);
    setEditingId(null);
  };

  const handleSubjSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (editingId) {
        await subjectService.update(editingId, subjForm);
        setSuccessMsg('Subject updated successfully.');
      } else {
        await subjectService.create(subjForm);
        setSuccessMsg('Subject created successfully.');
      }
      handleCloseSubj();
      loadData();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to submit subject.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubj = async (id) => {
    if (!window.confirm('Delete this subject?')) return;
    try {
      await subjectService.delete(id);
      setSuccessMsg('Subject deleted successfully.');
      loadData();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to delete subject.');
    }
  };

  if (loading && departments.length === 0) {
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
            Academic Resource Setup
          </Typography>
          <Typography color="textSecondary" variant="subtitle1">
            Configure subjects, department profiles, and assign faculty mentors.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={tabIndex === 0 ? () => handleOpenDept() : () => handleOpenSubj()}
          sx={{ borderRadius: '12px', px: 3, py: 1.2, textTransform: 'none', fontWeight: 'bold', backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        >
          {tabIndex === 0 ? 'Add Department' : 'Add Subject'}
        </Button>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{errorMsg}</Alert>}

      <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabIndex} onChange={(e, index) => setTabIndex(index)} sx={{ px: 2 }}>
            <Tab label="Departments" sx={{ textTransform: 'none', fontWeight: 'bold' }} />
            <Tab label="Subjects" sx={{ textTransform: 'none', fontWeight: 'bold' }} />
          </Tabs>
        </Box>

        {tabIndex === 0 ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Dept Code</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Department Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>HOD Email</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Contact Phone</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {departments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      No departments registered.
                    </TableCell>
                  </TableRow>
                ) : (
                  departments.map((row) => (
                    <TableRow key={row.id || row._id} sx={{ '&:hover': { bgcolor: '#f7fafc' } }}>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{row.code}</TableCell>
                      <TableCell sx={{ fontWeight: '500' }}>{row.name}</TableCell>
                      <TableCell>{row.contact_email}</TableCell>
                      <TableCell>{row.contact_phone}</TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                          <IconButton color="primary" onClick={() => handleOpenDept(row)} size="small">
                            <Edit />
                          </IconButton>
                          <IconButton color="error" onClick={() => handleDeleteDept(row.id || row._id)} size="small">
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
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Subject Code</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Course Title</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Credits</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Sem / Dept</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {subjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      No subjects configured.
                    </TableCell>
                  </TableRow>
                ) : (
                  subjects.map((row) => (
                    <TableRow key={row.id || row._id} sx={{ '&:hover': { bgcolor: '#f7fafc' } }}>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{row.code}</TableCell>
                      <TableCell sx={{ fontWeight: '500' }}>{row.name}</TableCell>
                      <TableCell>{row.credits} credits</TableCell>
                      <TableCell>Semester {row.semester} ({row.department_id})</TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                          <IconButton color="primary" onClick={() => handleOpenSubj(row)} size="small">
                            <Edit />
                          </IconButton>
                          <IconButton color="error" onClick={() => handleDeleteSubj(row.id || row._id)} size="small">
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
        )}
      </Card>

      {/* Department Dialog */}
      <Dialog open={deptOpen} onClose={handleCloseDept} maxWidth="xs" fullWidth PaperProps={{ style: { borderRadius: '16px' } }}>
        <form onSubmit={handleDeptSubmit}>
          <DialogTitle sx={{ fontWeight: 'bold' }}>{editingId ? 'Edit Department' : 'Create Department'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Department Name"
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Department Code"
                value={deptForm.code}
                onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                required
                fullWidth
                disabled={editingId !== null}
              />
              <TextField
                label="HOD Admin User ID"
                value={deptForm.hod_id}
                onChange={(e) => setDeptForm({ ...deptForm, hod_id: e.target.value })}
                required
                fullWidth
              />
              <TextField
                type="email"
                label="Contact Email Address"
                value={deptForm.contact_email}
                onChange={(e) => setDeptForm({ ...deptForm, contact_email: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Contact Phone Number"
                value={deptForm.contact_phone}
                onChange={(e) => setDeptForm({ ...deptForm, contact_phone: e.target.value })}
                required
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleCloseDept} variant="outlined" sx={{ borderRadius: '8px' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
              sx={{ borderRadius: '8px', fontWeight: 'bold' }}
            >
              {submitting ? 'Saving...' : (editingId ? 'Save changes' : 'Create Dept')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Subject Dialog */}
      <Dialog open={subjOpen} onClose={handleCloseSubj} maxWidth="xs" fullWidth PaperProps={{ style: { borderRadius: '16px' } }}>
        <form onSubmit={handleSubjSubmit}>
          <DialogTitle sx={{ fontWeight: 'bold' }}>{editingId ? 'Edit Subject' : 'Add Subject Course'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Subject Name"
                value={subjForm.name}
                onChange={(e) => setSubjForm({ ...subjForm, name: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Subject Code"
                value={subjForm.code}
                onChange={(e) => setSubjForm({ ...subjForm, code: e.target.value.toUpperCase() })}
                required
                fullWidth
                disabled={editingId !== null}
              />
              <TextField
                label="Course Description"
                value={subjForm.description}
                onChange={(e) => setSubjForm({ ...subjForm, description: e.target.value })}
                multiline
                rows={2}
                fullWidth
              />
              <TextField
                type="number"
                label="Course Credits"
                value={subjForm.credits}
                onChange={(e) => setSubjForm({ ...subjForm, credits: parseInt(e.target.value) || 3 })}
                required
                fullWidth
              />
              <TextField
                select
                label="Department Code"
                value={subjForm.department_id}
                onChange={(e) => setSubjForm({ ...subjForm, department_id: e.target.value })}
                required
                fullWidth
              >
                {departments.map((d) => (
                  <MenuItem key={d.id || d._id} value={d.code}>{d.name}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Mentoring Faculty User"
                value={subjForm.faculty_id}
                onChange={(e) => setSubjForm({ ...subjForm, faculty_id: e.target.value })}
                required
                fullWidth
              >
                {facultyUsers.map((f) => (
                  <MenuItem key={f.id || f._id} value={f.id || f._id}>{f.first_name} {f.last_name}</MenuItem>
                ))}
              </TextField>
              <TextField
                type="number"
                label="Semester"
                value={subjForm.semester}
                onChange={(e) => setSubjForm({ ...subjForm, semester: parseInt(e.target.value) || 1 })}
                required
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleCloseSubj} variant="outlined" sx={{ borderRadius: '8px' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
              sx={{ borderRadius: '8px', fontWeight: 'bold' }}
            >
              {submitting ? 'Saving...' : (editingId ? 'Save changes' : 'Add Subject')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default ManageSubjects;
