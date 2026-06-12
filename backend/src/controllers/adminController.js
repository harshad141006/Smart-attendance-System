import { firebaseDb } from '../config/firebase.js';

export const getStudents = async (req, res) => {
  try {
    const userRole = req.user.role;
    if (!['faculty', 'advisor', 'hod'].includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    try {
      const snapshot = await firebaseDb
        .collection('users')
        .where('role', '==', 'student')
        .get();

      const students = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      }));

      res.json({
        total: students.length,
        students,
      });
    } catch (firebaseError) {
      res.json({ total: 0, students: [] });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAttendanceReport = async (req, res) => {
  try {
    const { courseId, startDate, endDate } = req.query;
    const userRole = req.user.role;

    if (!['faculty', 'advisor', 'hod'].includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (!courseId) {
      return res.status(400).json({ error: 'courseId required' });
    }

    try {
      const snapshot = await firebaseDb
        .collection('attendance')
        .where('courseId', '==', courseId)
        .get();

      let records = snapshot.docs.map(doc => doc.data());

      // Filter by date
      if (startDate) {
        records = records.filter(r => {
          const recordDate = r.timestamp?.toDate?.() || new Date(r.timestamp);
          return recordDate >= new Date(startDate);
        });
      }
      if (endDate) {
        records = records.filter(r => {
          const recordDate = r.timestamp?.toDate?.() || new Date(r.timestamp);
          return recordDate <= new Date(endDate);
        });
      }

      // Group by student
      const studentStats = {};
      records.forEach(record => {
        if (!studentStats[record.userEmail]) {
          studentStats[record.userEmail] = {
            email: record.userEmail,
            userId: record.userId,
            present: 0,
            absent: 0,
          };
        }
        if (record.status === 'present') {
          studentStats[record.userEmail].present++;
        } else {
          studentStats[record.userEmail].absent++;
        }
      });

      const stats = Object.values(studentStats).map(stat => ({
        ...stat,
        total: stat.present + stat.absent,
        percentage: (stat.present / (stat.present + stat.absent)) * 100,
      }));

      res.json({
        courseId,
        period: {
          startDate: startDate || 'N/A',
          endDate: endDate || 'N/A',
        },
        totalRecords: records.length,
        students: stats.length,
        report: stats,
      });
    } catch (firebaseError) {
      res.json({
        courseId,
        totalRecords: 0,
        students: 0,
        report: [],
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getSystemStats = async (req, res) => {
  try {
    const userRole = req.user.role;
    if (!['admin', 'hod'].includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    try {
      const usersSnapshot = await firebaseDb.collection('users').get();
      const attendanceSnapshot = await firebaseDb.collection('attendance').get();

      const users = usersSnapshot.docs.map(doc => doc.data());
      const attendanceRecords = attendanceSnapshot.docs.map(doc => doc.data());

      const stats = {
        totalUsers: users.length,
        students: users.filter(u => u.role === 'student').length,
        faculty: users.filter(u => u.role === 'faculty').length,
        advisors: users.filter(u => u.role === 'advisor').length,
        hods: users.filter(u => u.role === 'hod').length,
        totalAttendanceRecords: attendanceRecords.length,
        averageFaceDistance: attendanceRecords.length > 0
          ? (attendanceRecords.reduce((sum, r) => sum + (r.faceDistance || 0), 0) / attendanceRecords.length).toFixed(3)
          : 0,
        averageConfidence: attendanceRecords.length > 0
          ? (attendanceRecords.reduce((sum, r) => sum + (r.confidence || 0), 0) / attendanceRecords.length).toFixed(1)
          : 0,
      };

      res.json(stats);
    } catch (firebaseError) {
      res.json({
        totalUsers: 0,
        students: 0,
        faculty: 0,
        advisors: 0,
        hods: 0,
        totalAttendanceRecords: 0,
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const exportAttendanceReport = async (req, res) => {
  try {
    const { courseId, format = 'json' } = req.query;
    const userRole = req.user.role;

    if (!['faculty', 'advisor', 'hod'].includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (!courseId) {
      return res.status(400).json({ error: 'courseId required' });
    }

    try {
      const snapshot = await firebaseDb
        .collection('attendance')
        .where('courseId', '==', courseId)
        .get();

      const records = snapshot.docs.map(doc => doc.data());

      if (format === 'csv') {
        let csv = 'Email,Course,Date,Time,Status,Face Distance,Confidence\n';
        records.forEach(record => {
          const date = record.timestamp?.toDate?.() || new Date(record.timestamp);
          csv += `${record.userEmail},${record.courseId},${date.toLocaleDateString()},${date.toLocaleTimeString()},${record.status},${record.faceDistance || 'N/A'},${record.confidence || 'N/A'}\n`;
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="attendance-${courseId}.csv"`);
        res.send(csv);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="attendance-${courseId}.json"`);
        res.json(records);
      }
    } catch (firebaseError) {
      res.status(500).json({ error: 'Failed to export report' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
