import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Grid, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Alert } from '@mui/material';
import { advisorService, facultyService } from '../../services';
import { BarChart, People, AssignmentTurnedIn, LocalActivity, Wifi } from '@mui/icons-material';

const AdvisorDashboard = () => {
  const [analytics, setAnalytics] = useState({ overall_attendance_average: 0, total_students: 0, shortage_count: 0 });
  const [odRequests, setOdRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Approval Dialog controls
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionStatus, setActionStatus] = useState('approved'); // approved / rejected
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Manage Hotspot state
  const [facultyUserId, setFacultyUserId] = useState('');
  const [facultyHotspotSSID, setFacultyHotspotSSID] = useState('');
  const [facultyHotspotBSSID, setFacultyHotspotBSSID] = useState('');
  const [hotspotSubmitting, setHotspotSubmitting] = useState(false);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const analyticsRes = await advisorService.getAnalytics();
      setAnalytics(analyticsRes.data);

      const odRes = await advisorService.getODRequests();
      setOdRequests(odRes.data || []);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load advisor dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleOpenApproval = (req, status) => {
    setSelectedRequest(req);
    setActionStatus(status);
    setComment('');
    setDialogOpen(true);
  };

  const handleCloseApproval = () => {
    setDialogOpen(false);
    setSelectedRequest(null);
  };

  const handleApproveReject = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await advisorService.approveODRequest(selectedRequest.id || selectedRequest._id, actionStatus, comment);
      setSuccessMsg(`OD request has been successfully ${actionStatus}.`);
      handleCloseApproval();
      loadDashboardData();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to update OD request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateFacultyHotspot = async () => {
    if (!facultyUserId || !facultyHotspotSSID || !facultyHotspotBSSID) {
      setErrorMsg('Please fill all hotspot fields.');
      return;
    }
    setHotspotSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await facultyService.updateHotspotConfig(facultyUserId, facultyHotspotSSID, facultyHotspotBSSID);
      setSuccessMsg('Faculty Hotspot Config updated successfully.');
      setFacultyUserId('');
      setFacultyHotspotSSID('');
      setFacultyHotspotBSSID('');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to update faculty hotspot config.');
    } finally {
      setHotspotSubmitting(false);
    }
  };

  if (loading && odRequests.length === 0 && analytics.total_students === 0) {
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
          Advisor Dashboard
        </Typography>
        <Typography color="textSecondary" variant="subtitle1">
          Monitor your batch enrollment, approve On Duty waivers, and track attendance shortages.
        </Typography>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{errorMsg}</Alert>}

      {/* Metrics Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(102, 126, 234, 0.1)', mr: 2 }}>
                <People sx={{ fontSize: 32, color: 'primary.main' }} />
              </Box>
              <Box>
                <Typography color="textSecondary" variant="caption">ADVISED STUDENTS</Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 0.5 }}>{analytics.total_students} Students</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(76, 175, 80, 0.1)', mr: 2 }}>
                <BarChart sx={{ fontSize: 32, color: 'success.main' }} />
              </Box>
              <Box>
                <Typography color="textSecondary" variant="caption">BATCH ATTENDANCE RATE</Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                  {analytics.overall_attendance_average.toFixed(1)}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(229, 62, 62, 0.1)', mr: 2 }}>
                <AssignmentTurnedIn sx={{ fontSize: 32, color: 'error.main' }} />
              </Box>
              <Box>
                <Typography color="textSecondary" variant="caption">ATTENDANCE SHORTAGES</Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 0.5, color: 'error.main' }}>
                  {analytics.shortage_count} Students
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Pending OD requests */}
      <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3, display: 'flex', alignItems: 'center' }}>
            <LocalActivity sx={{ mr: 1, color: 'primary.main' }} />
            Pending On Duty (OD) Requests
          </Typography>

          {odRequests.length === 0 ? (
            <Typography color="textSecondary">No pending OD requests found for your batch.</Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Student Name</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Enrollment Number</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Session Topic</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Reason for OD</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Requested On</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {odRequests.map((req) => (
                    <TableRow key={req.id || req._id} sx={{ '&:hover': { bgcolor: '#f7fafc' } }}>
                      <TableCell sx={{ fontWeight: '500' }}>{req.student_name}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{req.enrollment_number}</TableCell>
                      <TableCell>{req.session_title}</TableCell>
                      <TableCell>{req.reason}</TableCell>
                      <TableCell>{new Date(req.requested_at).toLocaleDateString()}</TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                          <Button
                            variant="contained"
                            color="success"
                            size="small"
                            onClick={() => handleOpenApproval(req, 'approved')}
                            sx={{ textTransform: 'none', borderRadius: '6px' }}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            onClick={() => handleOpenApproval(req, 'rejected')}
                            sx={{ textTransform: 'none', borderRadius: '6px' }}
                          >
                            Reject
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Manage Faculty Hotspots */}
      <Card sx={{ mt: 4, borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3, display: 'flex', alignItems: 'center' }}>
            <Wifi sx={{ mr: 1, color: 'secondary.main' }} />
            Manage Faculty Hotspots
          </Typography>
          <Typography color="textSecondary" sx={{ mb: 3 }}>
            Update the fallback Hotspot SSID and BSSID for a specific faculty member. You can lookup by Name, Email, or User ID.
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Faculty Name, Email, or ID"
                value={facultyUserId}
                onChange={(e) => setFacultyUserId(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Hotspot SSID"
                value={facultyHotspotSSID}
                onChange={(e) => setFacultyHotspotSSID(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Hotspot BSSID"
                value={facultyHotspotBSSID}
                onChange={(e) => setFacultyHotspotBSSID(e.target.value)}
                size="small"
                placeholder="e.g. 00:11:22:33:44:55"
              />
            </Grid>
            <Grid item xs={12} sm={2} sx={{ display: 'flex', alignItems: 'center' }}>
              <Button
                variant="contained"
                color="secondary"
                fullWidth
                onClick={handleUpdateFacultyHotspot}
                disabled={hotspotSubmitting || !facultyUserId}
                sx={{ borderRadius: '8px', textTransform: 'none' }}
              >
                {hotspotSubmitting ? 'Updating...' : 'Update Config'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Approve/Reject dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseApproval} maxWidth="xs" fullWidth PaperProps={{ style: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          {actionStatus === 'approved' ? 'Approve OD Request' : 'Reject OD Request'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Confirm decision for student {selectedRequest?.student_name}. Add optional feedback comment below.
          </Typography>
          <TextField
            fullWidth
            label="Feedback Comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            multiline
            rows={3}
            placeholder="e.g. Approved. Keep it up! or Rejected due to lack of certificate support."
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseApproval} variant="outlined" sx={{ borderRadius: '8px' }}>
            Cancel
          </Button>
          <Button
            onClick={handleApproveReject}
            variant="contained"
            color={actionStatus === 'approved' ? 'success' : 'error'}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
            sx={{ borderRadius: '8px', fontWeight: 'bold', textTransform: 'none' }}
          >
            {submitting ? 'Submitting...' : (actionStatus === 'approved' ? 'Approve OD' : 'Reject OD')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdvisorDashboard;
