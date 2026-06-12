import express from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';
import {
  markAttendance,
  getAttendance,
  getCourseAttendance,
  getAttendanceStats,
} from '../controllers/attendanceController.js';

const router = express.Router();

// Student routes
router.post('/mark', authMiddleware, markAttendance);
router.get('/my-records', authMiddleware, getAttendance);
router.get('/stats', authMiddleware, getAttendanceStats);

// Faculty/Advisor/HOD routes
router.get('/course/:courseId', 
  authMiddleware, 
  roleMiddleware('faculty', 'advisor', 'hod'), 
  getCourseAttendance
);

export default router;
