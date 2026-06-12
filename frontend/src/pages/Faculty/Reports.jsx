import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, TextField, Button, Grid, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert } from '@mui/material';
import { facultyService } from '../../services';
import { FileDownload, TableChart, PictureAsPdf } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

const FacultyReports = () => {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  
  // Data reports
  const [rosterData, setRosterData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        const res = await facultyService.getSessions();
        setSessions(res.data.sessions || []);
        if (res.data.sessions.length > 0) {
          setSelectedSessionId(res.data.sessions[0].id || res.data.sessions[0]._id);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg('Failed to load sessions list.');
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, []);

  useEffect(() => {
    if (!selectedSessionId) return;
    const fetchRoster = async () => {
      try {
        setRosterLoading(true);
        setErrorMsg('');
        const res = await facultyService.exportSessionAttendance(selectedSessionId);
        setRosterData(res.data);
      } catch (err) {
        console.error(err);
        setErrorMsg('Failed to retrieve roster data for selected session.');
      } finally {
        setRosterLoading(false);
      }
    };
    fetchRoster();
  }, [selectedSessionId]);

  const handleExportExcel = () => {
    if (!rosterData || rosterData.export_data.length === 0) return;
    try {
      const formatted = rosterData.export_data.map(r => ({
        'Student Name': `${r.first_name} ${r.last_name}`,
        'Enrollment Number': r.enrollment_number,
        'Department': r.department,
        'Batch': r.batch,
        'Semester': r.semester,
        'Attendance Status': r.status.toUpperCase(),
        'Marked Time': r.marking_time ? new Date(r.marking_time).toLocaleString() : 'N/A'
      }));

      const worksheet = XLSX.utils.json_to_sheet(formatted);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Session Attendance');
      
      // Auto-fit columns
      const maxLens = Object.keys(formatted[0]).map(key => 
        Math.max(...formatted.map(item => String(item[key] || '').length), key.length)
      );
      worksheet['!cols'] = maxLens.map(len => ({ wch: len + 3 }));

      XLSX.writeFile(workbook, `${rosterData.session_title}_Attendance_Report.xlsx`);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to generate Excel download.');
    }
  };

  const handleExportPdf = () => {
    if (!rosterData) return;
    try {
      const doc = new jsPDF();
      
      // Draw PDF layout
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('Smart Attendance System - Session Report', 14, 20);
      
      doc.setFontSize(12);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Subject: ${rosterData.subject_name}`, 14, 30);
      doc.text(`Session: ${rosterData.session_title}`, 14, 37);
      doc.text(`Date: ${new Date(rosterData.date).toLocaleDateString()}`, 14, 44);
      doc.text(`Total Students Roster: ${rosterData.total_students}`, 14, 51);
      doc.text(`Present: ${rosterData.export_data.filter(r => r.status === 'present').length}`, 14, 58);
      
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 64, 196, 64);
      
      // Draw Table headers
      doc.setFont('Helvetica', 'bold');
      doc.text('Enrollment No', 14, 72);
      doc.text('Student Name', 55, 72);
      doc.text('Status', 140, 72);
      doc.text('Marking Time', 165, 72);
      
      doc.line(14, 76, 196, 76);
      
      doc.setFont('Helvetica', 'normal');
      let y = 83;
      rosterData.export_data.forEach((r, idx) => {
        if (y > 275) {
          doc.addPage();
          y = 20; // reset y on new page
        }
        doc.text(r.enrollment_number, 14, y);
        doc.text(`${r.first_name} ${r.last_name}`, 55, y);
        doc.text(r.status.toUpperCase(), 140, y);
        doc.text(r.marking_time ? new Date(r.marking_time).toLocaleTimeString() : '—', 165, y);
        y += 8;
      });
      
      doc.save(`${rosterData.session_title}_Attendance_Report.pdf`);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to generate PDF download.');
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, background: 'linear-gradient(to right, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Attendance Reports
          </Typography>
          <Typography color="textSecondary" variant="subtitle1">
            Analyze historical rosters and download reports in Excel or PDF.
          </Typography>
        </Box>
      </Box>

      {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.03)' }}>
            <CardContent sx={{ p: 3 }}>
              <TextField
                select
                fullWidth
                label="Select Attendance Session"
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
              >
                {sessions.length === 0 ? (
                  <MenuItem value="">No sessions available</MenuItem>
                ) : (
                  sessions.map((sess) => (
                    <MenuItem key={sess.id || sess._id} value={sess.id || sess._id}>
                      {sess.session_title} ({sess.status.toUpperCase()})
                    </MenuItem>
                  ))
                )}
              </TextField>

              {rosterData && (
                <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    color="success"
                    startIcon={<TableChart />}
                    onClick={handleExportExcel}
                    disabled={rosterLoading || rosterData.export_data.length === 0}
                    sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
                  >
                    Export to Excel (.xlsx)
                  </Button>
                  <Button
                    variant="contained"
                    fullWidth
                    color="error"
                    startIcon={<PictureAsPdf />}
                    onClick={handleExportPdf}
                    disabled={rosterLoading || rosterData.export_data.length === 0}
                    sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
                  >
                    Export to PDF (.pdf)
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <CardContent sx={{ p: rosterLoading ? 4 : 0 }}>
              {rosterLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                  <CircularProgress />
                </Box>
              ) : !rosterData ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="textSecondary">Select a session on the left to load the attendance roster.</Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>Student Name</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Enrollment No</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Batch</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Time Marked</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rosterData.export_data.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                            No student check-ins found for this session.
                          </TableCell>
                        </TableRow>
                      ) : (
                        rosterData.export_data.map((row) => (
                          <TableRow key={row.student_id} sx={{ '&:hover': { bgcolor: '#f7fafc' } }}>
                            <TableCell sx={{ fontWeight: '500' }}>{row.first_name} {row.last_name}</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace' }}>{row.enrollment_number}</TableCell>
                            <TableCell>{row.batch}</TableCell>
                            <TableCell>
                              <Chip
                                label={row.status.toUpperCase()}
                                color={row.status === 'present' ? 'success' : (row.status === 'od' ? 'info' : 'error')}
                                size="small"
                                sx={{ fontWeight: 'bold' }}
                              />
                            </TableCell>
                            <TableCell>
                              {row.marking_time ? new Date(row.marking_time).toLocaleTimeString() : '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default FacultyReports;
