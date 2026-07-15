import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks';

export const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to={`/${user?.role}/dashboard`} replace />;
  }

  // Support both wrapper usage (<ProtectedRoute><Component/></ProtectedRoute>)
  // and layout route usage (<Route element={<ProtectedRoute><Layout/></ProtectedRoute>}>)
  return children ?? <Outlet />;
};

export const PublicRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuth();

  if (isAuthenticated && user?.role) {
    return <Navigate to={`/${user.role}/dashboard`} replace />;
  }

  return children;
};
