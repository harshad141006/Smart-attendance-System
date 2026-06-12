import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, TextField, Grid, CircularProgress, Alert } from '@mui/material';
import { studentService } from '../../services';

const StudentHistory = () => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await studentService.getAttendanceHistory();
        setRecords(res.data.records || res.data.attendance_records || []);
      } catch (err) {
        console.error(err);
        setErrorMsg('Failed to load attendance logs.');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const getStatusChip = (status) => {
    switch (status) {
      case 'present':
        return <Chip label="Present" color="success" size="small" sx={{ fontWeight: 'bold' }} />;
      case 'absent':
        return <Chip label="Absent" color="error" size="small" sx={{ fontWeight: 'bold' }} />;
      case 'od':
        return <Chip label="On Duty" color="info" size="small" sx={{ fontWeight: 'bold' }} />;
      default:
        return <Chip label={status.toUpperCase()} size="small" />;
    }
  };

  const filteredRecords = records.filter((rec) => {
    const matchesStatus = filterStatus === 'all' || rec.status === filterStatus;
    // Subject names or ids
    const matchesSubject = !filterSubject || 
      (rec.session_id && rec.session_id.toLowerCase().includes(filterSubject.toLowerCase())) ||
      (rec.courseId && rec.courseId.toLowerCase().includes(filterSubject.toLowerCase())) ||
      (rec.wifi_bssid && rec.wifi_bssid.toLowerCase().includes(filterSubject.toLowerCase()));
    return matchesStatus && matchesSubject;
  });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const presentCount = records.filter(r => r.status === 'present').length;
  const odCount = records.filter(r => r.status === 'od').length;
  const absentCount = records.filter(r => r.status === 'absent').length;
  const totalCount = records.length;
  const percentage = totalCount > 0 ? ((presentCount + odCount) / totalCount) * 100 : 0;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 800, background: 'linear-gradient(to right, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Attendance History
      </Typography>
      <Typography color="textSecondary" variant="subtitle1" sx={{ mb: 4 }}>
        Detailed logs and parameters of your class attendance markings.
      </Typography>

      {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}

      {/* Metrics Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={3}>
          <Card sx={{ borderRadius: '12px', textAlign: 'center', p: 1, boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }}>
            <Typography color="textSecondary" variant="caption">CLASSES REGISTERED</Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 0.5 }}>{totalCount}</Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card sx={{ borderRadius: '12px', textAlign: 'center', p: 1, boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }}>
            <Typography color="textSecondary" variant="caption" sx={{ color: 'success.main' }}>PRESENT COUNTS</Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 0.5, color: 'success.main' }}>{presentCount}</Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card sx={{ borderRadius: '12px', textAlign: 'center', p: 1, boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }}>
            <Typography color="textSecondary" variant="caption" sx={{ color: 'info.main' }}>ON DUTY (OD) APPROVED</Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 0.5, color: 'info.main' }}>{odCount}</Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card sx={{ borderRadius: '12px', textAlign: 'center', p: 1, boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }}>
            <Typography color="textSecondary" variant="caption" sx={{ color: percentage >= 75 ? 'success.main' : 'warning.main' }}>ATTENDANCE RATE</Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 0.5, color: percentage >= 75 ? 'success.main' : 'warning.main' }}>
              {percentage.toFixed(1)}%
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Filter Options */}
      <Card sx={{ mb: 4, borderRadius: '16px', boxShadow: '0 8px 16px rgba(0,0,0,0.03)' }}>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Search Session ID or BSSID"
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                select
                size="small"
                label="Status Filter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                SelectProps={{ native: true }}
              >
                <option value="all">All Logs</option>
                <option value="present">Present Only</option>
                <option value="absent">Absent Only</option>
                <option value="od">On Duty Only</option>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Roster Logs Table */}
      <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Session ID</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Marking Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>GPS Coordinates</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>WiFi BSSID Node</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Face Match Confidence</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No matching attendance logs found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((rec) => (
                  <TableRow key={rec.id || rec._id} sx={{ '&:hover': { bgcolor: '#f7fafc' } }}>
                    <TableCell sx={{ fontFamily: 'monospace' }}>
                      {rec.session_id ? `${rec.session_id.substring(0, 8)}...` : rec.courseId}
                    </TableCell>
                    <TableCell>{new Date(rec.marking_time || rec.timestamp).toLocaleString()}</TableCell>
                    <TableCell>{getStatusChip(rec.status)}</TableCell>
                    <TableCell>
                      {rec.latitude !== 0 ? (
                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                          Lat: {rec.latitude.toFixed(4)}, Lon: {rec.longitude.toFixed(4)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic', fontSize: '0.8rem' }}>
                          N/A (Manual override)
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{rec.wifi_bssid || 'N/A'}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>
                      {rec.status === 'present' ? `${((rec.face_confidence || rec.confidence || 0) * 100).toFixed(0)}%` : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
};

export default StudentHistory;
