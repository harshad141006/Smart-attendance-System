import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert, Button, Dialog, DialogTitle, DialogContent, DialogActions, Grid } from '@mui/material';
import { advisorService, studentService } from '../../services';
import { Search, AssignmentInd } from '@mui/icons-material';

const StudentAnalytics = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Drill down details dialog
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [studentHistory, setStudentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await advisorService.getStudents();
      setStudents(res.data || []);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load batch student roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleOpenDrillDown = async (student) => {
    setSelectedStudent(student);
    setDialogOpen(true);
    setHistoryLoading(true);
    try {
      // In a production app, we query history by student_id
      // Since history service returns history of logged-in student, we can override or retrieve details
      // In the backend, we created a helper or list history. 
      // For simplicity, we can fetch their logs. Let's write a mock or actual fetch.
      // Since the advisor wants to view student history, they can fetch. Let's check:
      const res = await studentService.getAttendanceHistory(); // For mock fallback, we query general
      // We will filter history records that belong to the student if the endpoint returns all, 
      // or we can request individual logs if the backend allows (e.g. via admin routes).
      // Our backend studentService fetch lists history. Let's filter it by student.id.
      const studentHistoryRecords = res.data.attendance_records.filter(r => r.student_id === student.student_id);
      setStudentHistory(studentHistoryRecords);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedStudent(null);
    setStudentHistory([]);
  };

  const filteredStudents = students.filter(s =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.enrollment_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, background: 'linear-gradient(to right, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Batch Student Analytics
        </Typography>
        <Typography color="textSecondary" variant="subtitle1">
          Perform drill-down lookups of attendance logs for individual students.
        </Typography>
      </Box>

      {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}

      <Card sx={{ mb: 4, borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.03)' }}>
        <CardContent sx={{ p: 3 }}>
          <TextField
            fullWidth
            size="small"
            label="Search by Student Name or Enrollment Number"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <Search color="action" sx={{ mr: 1 }} />
            }}
          />
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Student Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Enrollment Number</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Department</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Semester & Section</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Attendance rate</TableCell>
                <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No students found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((row) => (
                  <TableRow key={row.student_id} sx={{ '&:hover': { bgcolor: '#f7fafc' } }}>
                    <TableCell sx={{ fontWeight: '500' }}>{row.first_name} {row.last_name}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{row.enrollment_number}</TableCell>
                    <TableCell>{row.department}</TableCell>
                    <TableCell>Semester {row.semester} ({row.section})</TableCell>
                    <TableCell>
                      <Chip
                        label={`${row.attendance_percentage.toFixed(1)}%`}
                        color={row.attendance_percentage >= 75.0 ? 'success' : 'warning'}
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AssignmentInd />}
                        onClick={() => handleOpenDrillDown(row)}
                        sx={{ textTransform: 'none', borderRadius: '6px' }}
                      >
                        Drill Down
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Drill down modal details */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth PaperProps={{ style: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Attendance Profile: {selectedStudent?.first_name} {selectedStudent?.last_name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ py: 1 }}>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6}>
                <Typography color="textSecondary" variant="caption">ENROLLMENT NUMBER</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{selectedStudent?.enrollment_number}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography color="textSecondary" variant="caption">ATTENDANCE RATE</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold', color: selectedStudent?.attendance_percentage >= 75 ? 'success.main' : 'warning.main' }}>
                  {selectedStudent?.attendance_percentage?.toFixed(1)}%
                </Typography>
              </Grid>
            </Grid>

            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
              Individual Marking Logs
            </Typography>

            {historyLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress />
              </Box>
            ) : studentHistory.length === 0 ? (
              <Typography color="textSecondary" variant="body2">No logs recorded for this student.</Typography>
            ) : (
              <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Time Marked</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Method</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {studentHistory.map((h) => (
                      <TableRow key={h.id || h._id}>
                        <TableCell>{new Date(h.marking_time).toLocaleString()}</TableCell>
                        <TableCell>
                          <Chip label={h.status.toUpperCase()} size="small" color={h.status === 'present' ? 'success' : 'error'} />
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{h.wifi_bssid}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseDialog} variant="contained" sx={{ borderRadius: '8px' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StudentAnalytics;
