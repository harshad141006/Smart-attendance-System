import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Grid, CircularProgress, Alert, Paper, Chip } from '@mui/material';
import { AccessTime, LocalCafe, School } from '@mui/icons-material';
import { timetableService } from '../../services';

const StudentTimetable = () => {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [timetables, setTimetables] = useState([]);

  useEffect(() => {
    const fetchTimetable = async () => {
      try {
        setLoading(true);
        const res = await timetableService.getStudentTimetable();
        setTimetables(res.data || []);
      } catch (err) {
        console.error(err);
        setErrorMsg('Failed to load your timetable. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchTimetable();
  }, []);

  if (loading) {
    return <Box display="flex" justifyContent="center" py={10}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 800 }}>
        My Timetable
      </Typography>
      <Typography color="textSecondary" sx={{ mb: 4 }}>
        Your weekly schedule configured by your class advisor.
      </Typography>

      {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}

      {timetables.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: '12px' }}>
          No timetable has been assigned to your batch yet.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {timetables.map((t, idx) => (
            <Grid item xs={12} md={6} lg={4} key={idx}>
              <Card sx={{ borderRadius: '16px', height: '100%' }}>
                <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
                  <Typography variant="h6" fontWeight="bold">
                    {t.day_of_week}
                  </Typography>
                </Box>
                <CardContent sx={{ p: 2 }}>
                  {t.periods?.sort((a, b) => a.start_time.localeCompare(b.start_time)).map((p, pIdx) => (
                    <Paper 
                      key={pIdx} 
                      elevation={0}
                      sx={{ 
                        p: 2, 
                        mb: 2, 
                        bgcolor: p.is_break ? '#fffaf0' : '#f8fafc',
                        borderLeft: `4px solid ${p.is_break ? '#ed8936' : '#667eea'}`,
                        borderRadius: '8px'
                      }}
                    >
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {p.is_break ? <LocalCafe fontSize="small" color="secondary" /> : <School fontSize="small" color="primary" />}
                            {p.is_break ? p.title : `Lecture ${pIdx + 1}`}
                          </Typography>
                          
                          <Typography variant="body2" color="textSecondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                            <AccessTime fontSize="small" /> {p.start_time} - {p.end_time}
                          </Typography>
                        </Box>

                        {p.is_break ? (
                          <Chip label="Break" size="small" color="secondary" variant="outlined" />
                        ) : (
                          <Chip label="Academic" size="small" color="primary" variant="outlined" />
                        )}
                      </Box>
                    </Paper>
                  ))}
                  {(!t.periods || t.periods.length === 0) && (
                    <Typography variant="body2" color="textSecondary" align="center" sx={{ py: 3 }}>
                      No periods scheduled.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default StudentTimetable;
