import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, TextField, Button, Grid, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert } from '@mui/material';
import { reportService, departmentService } from '../../services';
import { TableChart, PictureAsPdf } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

const AdminReports = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Filter settings
  const [deptCode, setDeptCode] = useState('');
  const [semester, setSemester] = useState(1);
  const [batch, setBatch] = useState('2024');
  
  // Report results
  const [reportResult, setReportResult] = useState(null);

  useEffect(() => {
    const fetchDepts = async () => {
      try {
        setLoading(true);
        const res = await departmentService.list();
        setDepartments(res.data || []);
        if (res.data.length > 0) {
          setDeptCode(res.data[0].code);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg('Failed to load departments.');
      } finally {
        setLoading(false);
      }
    };
    fetchDepts();
  }, []);

  const handleGenerateReport = async (e) => {
    e.preventDefault();
    if (!deptCode) return;
    
    setReportLoading(true);
    setErrorMsg('');
    setReportResult(null);
    try {
      const res = await reportService.getSemester(deptCode, semester, batch);
      setReportResult(res.data);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to generate semester report.');
    } finally {
      setReportLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!reportResult || reportResult.students.length === 0) return;
    try {
      const formatted = reportResult.students.map(s => ({
        'Student Name': `${s.first_name} ${s.last_name}`,
        'Enrollment Number': s.enrollment_number,
        'Present Classes': s.present_count,
        'Absent Classes': s.absent_count,
        'On Duty Approved': s.od_count,
        'Attendance rate': `${s.attendance_percentage.toFixed(1)}%`
      }));

      const worksheet = XLSX.utils.json_to_sheet(formatted);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Semester Attendance');
      
      const maxLens = Object.keys(formatted[0]).map(key => 
        Math.max(...formatted.map(item => String(item[key] || '').length), key.length)
      );
      worksheet['!cols'] = maxLens.map(len => ({ wch: len + 3 }));

      XLSX.writeFile(workbook, `${deptCode}_Sem${semester}_Batch${batch}_Roster.xlsx`);
    } catch (err) {
      console.error(err);
      setErrorMsg('Excel export failed.');
    }
  };

  const handleExportPdf = () => {
    if (!reportResult) return;
    try {
      const doc = new jsPDF();
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('Smart Attendance System - Semester Report', 14, 20);
      
      doc.setFontSize(12);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Department: ${deptCode}`, 14, 30);
      doc.text(`Semester: ${semester} | Batch: ${batch}`, 14, 37);
      doc.text(`Export Timestamp: ${new Date().toLocaleDateString()}`, 14, 44);
      
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 50, 196, 50);
      
      doc.setFont('Helvetica', 'bold');
      doc.text('Enrollment No', 14, 58);
      doc.text('Student Name', 55, 58);
      doc.text('Present', 120, 58);
      doc.text('Absent', 140, 58);
      doc.text('OD Count', 160, 58);
      doc.text('Rate', 180, 58);
      
      doc.line(14, 62, 196, 62);
      
      doc.setFont('Helvetica', 'normal');
      let y = 69;
      reportResult.students.forEach((s) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(s.enrollment_number, 14, y);
        doc.text(`${s.first_name} ${s.last_name}`, 55, y);
        doc.text(String(s.present_count), 120, y);
        doc.text(String(s.absent_count), 140, y);
        doc.text(String(s.od_count), 160, y);
        doc.text(`${s.attendance_percentage.toFixed(0)}%`, 180, y);
        y += 8;
      });
      
      doc.save(`${deptCode}_Sem${semester}_Batch${batch}_Roster.pdf`);
    } catch (err) {
      console.error(err);
      setErrorMsg('PDF export failed.');
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
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, background: 'linear-gradient(to right, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Semester Roster Reports
        </Typography>
        <Typography color="textSecondary" variant="subtitle1">
          Compile batch reports, audit student percentages, and export logs.
        </Typography>
      </Box>

      {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}

      <Grid container spacing={3}>
        {/* Filter Form Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.03)' }}>
            <CardContent sx={{ p: 3 }}>
              <form onSubmit={handleGenerateReport}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  <TextField
                    select
                    fullWidth
                    label="Department"
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value)}
                    required
                  >
                    {departments.map((d) => (
                      <MenuItem key={d.id || d._id} value={d.code}>{d.name}</MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    type="number"
                    fullWidth
                    label="Semester"
                    value={semester}
                    onChange={(e) => setSemester(parseInt(e.target.value) || 1)}
                    required
                    inputProps={{ min: 1, max: 8 }}
                  />

                  <TextField
                    fullWidth
                    label="Batch / Graduation Year"
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
                    required
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    disabled={reportLoading}
                    sx={{ py: 1.2, borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
                  >
                    {reportLoading ? 'Compiling Report...' : 'Compile Semester Report'}
                  </Button>
                </Box>
              </form>

              {reportResult && (
                <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Divider />
                  <Button
                    variant="contained"
                    color="success"
                    fullWidth
                    startIcon={<TableChart />}
                    onClick={handleExportExcel}
                    sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
                  >
                    Export to Excel (.xlsx)
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    fullWidth
                    startIcon={<PictureAsPdf />}
                    onClick={handleExportPdf}
                    sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}
                  >
                    Export to PDF (.pdf)
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Report Output table */}
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <CardContent sx={{ p: reportLoading ? 4 : 0 }}>
              {reportLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                  <CircularProgress />
                </Box>
              ) : !reportResult ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="textSecondary">Configure filters and generate report to view records roster.</Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>Student Name</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Enrollment No</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>P / A / OD</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Attendance Rate</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {reportResult.students.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                            No students registered under this academic config.
                          </TableCell>
                        </TableRow>
                      ) : (
                        reportResult.students.map((s) => (
                          <TableRow key={s.student_id} sx={{ '&:hover': { bgcolor: '#f7fafc' } }}>
                            <TableCell sx={{ fontWeight: '500' }}>{s.first_name} {s.last_name}</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace' }}>{s.enrollment_number}</TableCell>
                            <TableCell>
                              <Chip label={`${s.present_count} present`} size="small" color="success" sx={{ mr: 0.5 }} />
                              <Chip label={`${s.absent_count} absent`} size="small" color="error" sx={{ mr: 0.5 }} />
                              <Chip label={`${s.od_count} OD`} size="small" color="info" />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={`${s.attendance_percentage.toFixed(1)}%`}
                                color={s.attendance_percentage >= 75 ? 'success' : 'warning'}
                                size="small"
                                sx={{ fontWeight: 'bold' }}
                              />
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

import { Divider } from '@mui/material';
export default AdminReports;
