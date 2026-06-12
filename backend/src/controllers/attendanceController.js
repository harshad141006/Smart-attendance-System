import { firebaseDb } from '../config/firebase.js';

// Demo in-memory attendance storage
const demoAttendance = [];

export const markAttendance = async (req, res) => {
  try {
    const { courseId, latitude, longitude, faceDistance, confidence } = req.body;
    const userId = req.user.uid || req.user.id;
    const userEmail = req.user.email;

    if (!courseId) {
      return res.status(400).json({ error: 'courseId required' });
    }

    const attendanceRecord = {
      userId,
      userEmail,
      courseId,
      timestamp: new Date(),
      latitude,
      longitude,
      faceDistance,
      confidence,
      status: 'present',
    };

    try {
      await firebaseDb.collection('attendance').add(attendanceRecord);
      res.status(201).json({
        message: 'Attendance marked',
        attendance: attendanceRecord,
      });
    } catch (firebaseError) {
      // Demo mode
      demoAttendance.push(attendanceRecord);
      res.status(201).json({
        message: 'Attendance marked (demo)',
        attendance: attendanceRecord,
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAttendance = async (req, res) => {
  try {
    const { courseId, startDate, endDate } = req.query;
    const userId = req.user.uid || req.user.id;

    let query = firebaseDb.collection('attendance').where('userId', '==', userId);

    if (courseId) {
      query = query.where('courseId', '==', courseId);
    }

    try {
      const snapshot = await query.get();
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filter by date if provided
      let filtered = records;
      if (startDate || endDate) {
        filtered = records.filter(record => {
          const recordDate = record.timestamp?.toDate?.() || new Date(record.timestamp);
          if (startDate && recordDate < new Date(startDate)) return false;
          if (endDate && recordDate > new Date(endDate)) return false;
          return true;
        });
      }

      res.json({
        total: filtered.length,
        records: filtered,
      });
    } catch (firebaseError) {
      // Demo mode
      let filtered = demoAttendance.filter(r => r.userId === userId);
      if (courseId) {
        filtered = filtered.filter(r => r.courseId === courseId);
      }
      res.json({
        total: filtered.length,
        records: filtered,
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCourseAttendance = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userRole = req.user.role;

    // Only faculty/advisor/hod can view course attendance
    if (!['faculty', 'advisor', 'hod'].includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    try {
      const snapshot = await firebaseDb
        .collection('attendance')
        .where('courseId', '==', courseId)
        .get();

      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Group by student
      const grouped = {};
      records.forEach(record => {
        if (!grouped[record.userEmail]) {
          grouped[record.userEmail] = [];
        }
        grouped[record.userEmail].push(record);
      });

      res.json({
        courseId,
        totalRecords: records.length,
        students: Object.keys(grouped).length,
        attendance: grouped,
      });
    } catch (firebaseError) {
      // Demo mode
      const records = demoAttendance.filter(r => r.courseId === courseId);
      const grouped = {};
      records.forEach(record => {
        if (!grouped[record.userEmail]) {
          grouped[record.userEmail] = [];
        }
        grouped[record.userEmail].push(record);
      });

      res.json({
        courseId,
        totalRecords: records.length,
        students: Object.keys(grouped).length,
        attendance: grouped,
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAttendanceStats = async (req, res) => {
  try {
    const { courseId } = req.query;
    const userId = req.user.uid || req.user.id;

    try {
      let query = firebaseDb.collection('attendance').where('userId', '==', userId);
      if (courseId) {
        query = query.where('courseId', '==', courseId);
      }

      const snapshot = await query.get();
      const records = snapshot.docs.map(doc => doc.data());

      const total = records.length;
      const present = records.filter(r => r.status === 'present').length;
      const percentage = total > 0 ? (present / total) * 100 : 0;

      res.json({
        total,
        present,
        absent: total - present,
        percentage: percentage.toFixed(2),
      });
    } catch (firebaseError) {
      // Demo mode
      let records = demoAttendance.filter(r => r.userId === userId);
      if (courseId) {
        records = records.filter(r => r.courseId === courseId);
      }

      const total = records.length;
      const present = records.filter(r => r.status === 'present').length;
      const percentage = total > 0 ? (present / total) * 100 : 0;

      res.json({
        total,
        present,
        absent: total - present,
        percentage: percentage.toFixed(2),
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
