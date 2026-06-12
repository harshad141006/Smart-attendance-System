import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { advisorService } from '../../services';
import { Send, Warning } from '@mui/icons-material';

const ShortageReports = () => {
  const [shortages, setShortages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Warning Dialog
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [warningMsg, setWarningMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchShortages = async () => {
    try {
      setLoading(true);
      const res = await advisorService.getShortageReports();
      setShortages(res.data || []);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load shortage report roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShortages();
  }, []);

  const handleOpenWarning = (student) => {
    setSelectedStudent(student);
    setWarningMsg(`Dear ${student.first_name}, your current attendance rate is ${student.attendance_percentage.toFixed(1)}%, which is below the mandatory 75% limit. Please attend upcoming lectures to prevent debarment from examination.`);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedStudent(null);
    setWarningMsg('');
  };

  const handleSendWarning = async () => {
    if (!selectedStudent || !warningMsg.trim()) return;
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await advisorService.sendWarning(selectedStudent.student_id, warningMsg);
      setSuccessMsg(`Warning alert notification successfully dispatched to ${selectedStudent.first_name} ${selectedStudent.last_name}.`);
      handleCloseDialog();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to dispatch warning.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && shortages.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, background: 'linear-gradient(to right, #e53e3e, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Attendance Shortage Reports
        </Typography>
        <Typography color="textSecondary" variant="subtitle1">
          Review advised students whose attendance is below 75%. Send warning alerts immediately.
        </Typography>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{errorMsg}</Alert>}

      {shortages.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center', borderRadius: '16px', bgcolor: 'rgba(76, 175, 80, 0.04)', border: '1px solid rgba(76, 175, 80, 0.2)' }}>
          <Typography sx={{ fontWeight: 'bold', color: 'success.main', mb: 1 }}>
            Great news! No attendance shortages.
          </Typography>
          <Typography color="textSecondary" variant="body2">
            All students in your batch are maintaining attendance above the 75% requirements.
          </Typography>
        </Card>
      ) : (
        <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#fff5f5' }}>
                  <TableCell sx={{ fontWeight: 'bold', color: '#c53030' }}>Student Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#c53030' }}>Enrollment Number</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#c53030' }}>Department & Batch</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#c53030' }}>Attendance Rate</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: '#c53030', textAlign: 'center' }}>Send Warning Alert</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shortages.map((row) => (
                  <TableRow key={row.student_id} sx={{ '&:hover': { bgcolor: '#fffafb' } }}>
                    <TableCell sx={{ fontWeight: '500' }}>{row.first_name} {row.last_name}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{row.enrollment_number}</TableCell>
                    <TableCell>{row.department} - Batch {row.batch}</TableCell>
                    <TableCell>
                      <Chip
                        icon={<Warning style={{ color: '#fff' }} />}
                        label={`${row.attendance_percentage.toFixed(1)}%`}
                        sx={{ bgcolor: '#e53e3e', color: '#fff', fontWeight: 'bold' }}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        variant="contained"
                        color="error"
                        size="small"
                        startIcon={<Send />}
                        onClick={() => handleOpenWarning(row)}
                        sx={{ textTransform: 'none', borderRadius: '6px' }}
                      >
                        Send Warning
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Dispatch Warning Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth PaperProps={{ style: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="error" />
          Send Low Attendance Warning
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Confirm and edit the warning notification content that will be dispatched to {selectedStudent?.first_name} {selectedStudent?.last_name}.
          </Typography>
          <TextField
            fullWidth
            label="Warning Message"
            value={warningMsg}
            onChange={(e) => setWarningMsg(e.target.value)}
            multiline
            rows={5}
            required
            variant="outlined"
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseDialog} variant="outlined" sx={{ borderRadius: '8px' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSendWarning}
            variant="contained"
            color="error"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Send />}
            sx={{ borderRadius: '8px', fontWeight: 'bold', textTransform: 'none' }}
          >
            {submitting ? 'Sending...' : 'Send Warning Alert'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ShortageReports;
