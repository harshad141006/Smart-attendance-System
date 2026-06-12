import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Grid, Button, TextField, MenuItem, Switch, FormControlLabel, IconButton, Alert, CircularProgress, Paper, Divider } from '@mui/material';
import { Add, Delete, AccessTime, School, LocalCafe } from '@mui/icons-material';
import { timetableService, subjectService } from '../../services';
import api from '../../services/api';

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TimetableManager = () => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [subjects, setSubjects] = useState([]);
  const [faculty, setFaculty] = useState([]);

  // Form State
  const [batch, setBatch] = useState('2026');
  const [department, setDepartment] = useState('Computer Science');
  const [section, setSection] = useState('A');
  const [dayOfWeek, setDayOfWeek] = useState('Monday');

  const [periods, setPeriods] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [subRes, facRes] = await Promise.all([
          subjectService.list(),
          api.get('/faculty/list') // Use the proper faculty endpoint
        ]);
        const subData = subRes.data;
        setSubjects(Array.isArray(subData) ? subData : (subData?.subjects || []));
        
        const facData = facRes.data;
        const facArray = Array.isArray(facData) ? facData : (facData?.users || facData?.data || []);
        // Safely set faculty from the new endpoint structure
        setFaculty(facArray);
      } catch (err) {
        console.error("Failed to load reference data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchTimetable = async () => {
      try {
        const res = await timetableService.getTimetable(batch, department, section, dayOfWeek);
        if (res.data && res.data.periods && res.data.periods.length > 0) {
          const loadedPeriods = res.data.periods.map(p => ({
            title: p.title || '',
            start_time: p.start_time || '09:00',
            end_time: p.end_time || '10:00',
            is_break: p.is_break || false,
            faculty_id: p.faculty_id || '',
            subject_id: p.subject_id || ''
          }));
          setPeriods(loadedPeriods);
        } else {
          setPeriods([]);
        }
      } catch (err) {
        console.error("Failed to load timetable", err);
        setPeriods([]);
      }
    };
    if (batch && department && section && dayOfWeek) {
      fetchTimetable();
    }
  }, [batch, department, section, dayOfWeek]);

  const addPeriod = (isBreak = false) => {
    setPeriods([...periods, {
      title: isBreak ? 'Break' : '',
      start_time: '09:00',
      end_time: '10:00',
      is_break: isBreak,
      faculty_id: '',
      subject_id: ''
    }]);
  };

  const removePeriod = (index) => {
    setPeriods(periods.filter((_, i) => i !== index));
  };

  const updatePeriod = (index, field, value) => {
    const updated = [...periods];
    updated[index][field] = value;
    setPeriods(updated);
  };

  const handleSave = async () => {
    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Validation
      if (periods.length === 0) throw new Error("Please add at least one period.");
      for (const p of periods) {
        if (!p.title && p.is_break) throw new Error("Breaks must have a title.");
        if (!p.is_break && (!p.subject_id || !p.faculty_id)) {
          throw new Error("Academic periods must have a subject and assigned faculty.");
        }
      }

      await timetableService.saveTimetable({
        batch,
        department,
        section,
        day_of_week: dayOfWeek,
        periods
      });

      setSuccessMsg(`Timetable for ${dayOfWeek} saved successfully!`);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || err.response?.data?.detail || "Failed to save timetable");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Box display="flex" justifyContent="center" py={10}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 800 }}>
        Timetable Manager
      </Typography>
      <Typography color="textSecondary" sx={{ mb: 4 }}>
        Create and assign periods and breaks for a specific batch.
      </Typography>

      {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 3 }}>{successMsg}</Alert>}

      <Card sx={{ mb: 4, p: 2, borderRadius: '16px' }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth label="Batch" value={batch} onChange={e => setBatch(e.target.value)} size="small" />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth label="Department" value={department} onChange={e => setDepartment(e.target.value)} size="small" />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth label="Section" value={section} onChange={e => setSection(e.target.value)} size="small" />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField select fullWidth label="Day of Week" value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)} size="small">
                {DAYS_OF_WEEK.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Box display="flex" gap={2} mb={3}>
        <Button variant="contained" color="primary" startIcon={<School />} onClick={() => addPeriod(false)}>
          Add Lecture Period
        </Button>
        <Button variant="outlined" color="secondary" startIcon={<LocalCafe />} onClick={() => addPeriod(true)}>
          Add Break
        </Button>
      </Box>

      {periods.map((period, index) => (
        <Paper key={index} sx={{ p: 3, mb: 2, borderRadius: '12px', borderLeft: `6px solid ${period.is_break ? '#ed8936' : '#667eea'}` }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="subtitle1" fontWeight="bold" display="flex" alignItems="center" gap={1}>
              {period.is_break ? <LocalCafe fontSize="small" color="secondary" /> : <School fontSize="small" color="primary" />}
              {period.is_break ? 'Break Period' : `Academic Lecture ${index + 1}`}
            </Typography>
            <IconButton color="error" onClick={() => removePeriod(index)}>
              <Delete />
            </IconButton>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={6} sm={2}>
              <TextField
                fullWidth label="Start Time" type="time" size="small"
                value={period.start_time} onChange={(e) => updatePeriod(index, 'start_time', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField
                fullWidth label="End Time" type="time" size="small"
                value={period.end_time} onChange={(e) => updatePeriod(index, 'end_time', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {period.is_break ? (
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth label="Break Title" size="small" placeholder="e.g. Lunch Break"
                  value={period.title} onChange={(e) => updatePeriod(index, 'title', e.target.value)}
                />
              </Grid>
            ) : (
              <>
                <Grid item xs={12} sm={4}>
                  <TextField
                    select fullWidth label="Subject" size="small"
                    value={period.subject_id} onChange={(e) => updatePeriod(index, 'subject_id', e.target.value)}
                  >
                    {subjects.map(s => <MenuItem key={s.id} value={s.id}>{s.code} - {s.name}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    select fullWidth label="Assigned Faculty" size="small"
                    value={period.faculty_id} onChange={(e) => updatePeriod(index, 'faculty_id', e.target.value)}
                  >
                    {faculty.map(f => (
                      <MenuItem key={f._id || f.id} value={f._id || f.id}>
                        {f.first_name} {f.last_name} ({f.email})
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </>
            )}
          </Grid>
        </Paper>
      ))}

      {periods.length > 0 && (
        <Box mt={4} display="flex" justifyContent="flex-end">
          <Button 
            variant="contained" 
            size="large" 
            onClick={handleSave} 
            disabled={submitting}
            sx={{ px: 5, borderRadius: '8px', backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            {submitting ? 'Saving...' : 'Save Timetable'}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default TimetableManager;
