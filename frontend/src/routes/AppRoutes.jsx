import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, PublicRoute } from './ProtectedRoute';
import { useAuth } from '../hooks';

// Layout
const DashboardLayout = lazy(() => import('../layouts/DashboardLayout'));

// Public Pages
const LoginPage = lazy(() => import('../pages/LoginPage'));
const RegisterPage = lazy(() => import('../pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'));

// Student Pages
const StudentDashboard = lazy(() => import('../pages/Student/Dashboard'));
const StudentAttendance = lazy(() => import('../pages/Student/Attendance'));
const StudentHistory = lazy(() => import('../pages/Student/History'));
const StudentProfile = lazy(() => import('../pages/Student/Profile'));
const FaceRegistration = lazy(() => import('../pages/Student/FaceRegistration'));
const FaceDetectionTest = lazy(() => import('../pages/Student/FaceDetectionTest'));
const StudentNotifications = lazy(() => import('../pages/Student/Notifications'));
const StudentTimetable = lazy(() => import('../pages/Student/Timetable'));

// Faculty Pages
const FacultyDashboard = lazy(() => import('../pages/Faculty/Dashboard'));
const CreateSession = lazy(() => import('../pages/Faculty/CreateSession'));
const LiveAttendance = lazy(() => import('../pages/Faculty/LiveAttendance'));
const FacultyReports = lazy(() => import('../pages/Faculty/Reports'));

// Advisor Pages
const AdvisorDashboard = lazy(() => import('../pages/Advisor/Dashboard'));
const StudentAnalytics = lazy(() => import('../pages/Advisor/StudentAnalytics'));
const ShortageReports = lazy(() => import('../pages/Advisor/ShortageReports'));
const TimetableManager = lazy(() => import('../pages/Advisor/TimetableManager'));

// Admin Pages
const AdminDashboard = lazy(() => import('../pages/Admin/Dashboard'));
const ManageUsers = lazy(() => import('../pages/Admin/ManageUsers'));
const ManageSubjects = lazy(() => import('../pages/Admin/ManageSubjects'));
const AdminReports = lazy(() => import('../pages/Admin/Reports'));

const LoadingSpinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f5f7fa' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <div style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTop: '4px solid #667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <div style={{ fontStyle: 'normal', color: '#4a5568', fontWeight: '500' }}>Loading...</div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  </div>
);

const DashboardRedirect = () => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={`/${user.role}/dashboard`} replace />;
};

export const AppRoutes = () => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />

        {/* Protected Routes */}
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardRedirect />} />
          
          {/* Student Routes */}
          <Route path="/student/dashboard" element={<ProtectedRoute requiredRole="student"><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/timetable" element={<ProtectedRoute requiredRole="student"><StudentTimetable /></ProtectedRoute>} />
          <Route path="/student/register-face" element={<ProtectedRoute requiredRole="student"><FaceRegistration /></ProtectedRoute>} />
          <Route path="/student/attendance" element={<ProtectedRoute requiredRole="student"><StudentAttendance /></ProtectedRoute>} />
          <Route path="/student/history" element={<ProtectedRoute requiredRole="student"><StudentHistory /></ProtectedRoute>} />
          <Route path="/student/profile" element={<ProtectedRoute requiredRole="student"><StudentProfile /></ProtectedRoute>} />
          <Route path="/student/notifications" element={<ProtectedRoute requiredRole="student"><StudentNotifications /></ProtectedRoute>} />
          <Route path="/student/face-detect-test" element={<ProtectedRoute requiredRole="student"><FaceDetectionTest /></ProtectedRoute>} />

          {/* Faculty Routes */}
          <Route path="/faculty/dashboard" element={<ProtectedRoute requiredRole="faculty"><FacultyDashboard /></ProtectedRoute>} />
          <Route path="/faculty/create-session" element={<ProtectedRoute requiredRole="faculty"><CreateSession /></ProtectedRoute>} />
          <Route path="/faculty/live-attendance" element={<ProtectedRoute requiredRole="faculty"><LiveAttendance /></ProtectedRoute>} />
          <Route path="/faculty/reports" element={<ProtectedRoute requiredRole="faculty"><FacultyReports /></ProtectedRoute>} />

          {/* Advisor Routes */}
          <Route path="/advisor/dashboard" element={<ProtectedRoute requiredRole="advisor"><AdvisorDashboard /></ProtectedRoute>} />
          <Route path="/advisor/timetable" element={<ProtectedRoute requiredRole="advisor"><TimetableManager /></ProtectedRoute>} />
          <Route path="/advisor/analytics" element={<ProtectedRoute requiredRole="advisor"><StudentAnalytics /></ProtectedRoute>} />
          <Route path="/advisor/shortage-reports" element={<ProtectedRoute requiredRole="advisor"><ShortageReports /></ProtectedRoute>} />

          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/manage-users" element={<ProtectedRoute requiredRole="admin"><ManageUsers /></ProtectedRoute>} />
          <Route path="/admin/manage-subjects" element={<ProtectedRoute requiredRole="admin"><ManageSubjects /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute requiredRole="admin"><AdminReports /></ProtectedRoute>} />
        </Route>

        {/* Default Route */}
        <Route path="/" element={<DashboardRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

