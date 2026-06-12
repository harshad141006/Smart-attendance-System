import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Grid, CircularProgress, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { reportService, userService, subjectService } from '../../services';
import { AdminPanelSettings, School, Security, LibraryBooks } from '@mui/icons-material';

const AdminDashboard = () => {
  const [stats, setStats] = useState({ total_users: 0, total_subjects: 0, total_students: 0, total_faculty: 0 });
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchAdminStats = async () => {
      try {
        setLoading(true);
        setErrorMsg('');
        
        // Fetch all users to compute counts
        const usersRes = await userService.list();
        const users = usersRes.data || [];
        const studentCount = users.filter(u => u.role === 'student').length;
        const facultyCount = users.filter(u => u.role === 'faculty').length;
        
        // Fetch subjects
        const subjectsRes = await subjectService.list();
        const subjects = subjectsRes.data || [];
        
        setStats({
          total_users: users.length,
          total_students: studentCount,
          total_faculty: facultyCount,
          total_subjects: subjects.length
        });

        // Fetch audit logs
        const logsRes = await reportService.getAuditLogs();
        setAuditLogs(logsRes.data || []);
      } catch (err) {
        console.error(err);
        setErrorMsg('Failed to load system administrative statistics.');
      } finally {
        setLoading(false);
      }
    };
    fetchAdminStats();
  }, []);

  if (loading && auditLogs.length === 0) {
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
          System Administration
        </Typography>
        <Typography color="textSecondary" variant="subtitle1">
          Monitor system metrics, review audit trails, and manage academic resources.
        </Typography>
      </Box>

      {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(102, 126, 234, 0.1)', mr: 2 }}>
                <AdminPanelSettings sx={{ fontSize: 32, color: 'primary.main' }} />
              </Box>
              <Box>
                <Typography color="textSecondary" variant="caption">TOTAL ACCOUNTS</Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 0.5 }}>{stats.total_users}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(76, 175, 80, 0.1)', mr: 2 }}>
                <School sx={{ fontSize: 32, color: 'success.main' }} />
              </Box>
              <Box>
                <Typography color="textSecondary" variant="caption">STUDENTS</Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 0.5 }}>{stats.total_students}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(237, 137, 54, 0.1)', mr: 2 }}>
                <LibraryBooks sx={{ fontSize: 32, color: 'warning.main' }} />
              </Box>
              <Box>
                <Typography color="textSecondary" variant="caption">SUBJECTS</Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 0.5 }}>{stats.total_subjects}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(245, 101, 101, 0.1)', mr: 2 }}>
                <Security sx={{ fontSize: 32, color: 'error.main' }} />
              </Box>
              <Box>
                <Typography color="textSecondary" variant="caption">FACULTY STAFF</Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 0.5 }}>{stats.total_faculty}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* System Audit logs */}
      <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3, display: 'flex', alignItems: 'center' }}>
            <Security sx={{ mr: 1, color: 'error.main' }} />
            System Audit Trails
          </Typography>

          {auditLogs.length === 0 ? (
            <Typography color="textSecondary">No system audit trails available.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>User ID</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Action Trigger</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Resource Type</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>IP Location</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Timestamp</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id || log._id} sx={{ '&:hover': { bgcolor: '#f7fafc' } }}>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{log.user_id}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{log.action}</TableCell>
                      <TableCell>{log.resource_type}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{log.ip_address}</TableCell>
                      <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default AdminDashboard;
