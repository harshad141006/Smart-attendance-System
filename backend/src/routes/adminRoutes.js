import express from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';
import {
  getStudents,
  getAttendanceReport,
  getSystemStats,
  exportAttendanceReport,
} from '../controllers/adminController.js';

const router = express.Router();

// Protected routes - requires specific roles
router.get(
  '/students',
  authMiddleware,
  roleMiddleware('faculty', 'advisor', 'hod'),
  getStudents
);

router.get(
  '/attendance-report',
  authMiddleware,
  roleMiddleware('faculty', 'advisor', 'hod'),
  getAttendanceReport
);

router.get(
  '/attendance-report/export',
  authMiddleware,
  roleMiddleware('faculty', 'advisor', 'hod'),
  exportAttendanceReport
);

router.get(
  '/system-stats',
  authMiddleware,
  roleMiddleware('admin', 'hod'),
  getSystemStats
);

export default router;
