import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'express-async-errors';
import { config } from './src/config/index.js';
import { errorHandler, notFoundHandler } from './src/middleware/errorHandler.js';

// Routes
import authRoutes from './src/routes/authRoutes.js';
import attendanceRoutes from './src/routes/attendanceRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import visionRoutes from './src/routes/visionRoutes.js';
import notificationRoutes from './src/routes/notificationRoutes.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(config.PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║  🎓 Smart Attendance System - Backend Server          ║
╚════════════════════════════════════════════════════════╝

📡 Server Running:
   URL: http://localhost:${config.PORT}
   Environment: ${config.NODE_ENV}
   CORS Origin: ${config.CORS_ORIGIN}

📚 API Endpoints:
   POST   /api/auth/login
   POST   /api/auth/register
   GET    /api/auth/profile
   PUT    /api/auth/profile
   
   POST   /api/attendance/mark
   GET    /api/attendance/my-records
   GET    /api/attendance/stats
   GET    /api/attendance/course/:courseId
   
   GET    /api/admin/students
   GET    /api/admin/attendance-report
   GET    /api/admin/attendance-report/export
   GET    /api/admin/system-stats

⚡ Health Check:
   GET    /health

✅ Backend ready for connections!
  `);
});

export default app;
