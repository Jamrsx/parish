import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../library/AuthStorage';
import { authStorage } from '../../library/AuthStorage';

interface RequireAuthProps {
  children: React.ReactNode;
  roles?: UserRole[];
}

/** Blocks unauthenticated access; sends users to their role home if wrong role. */
export const RequireAuth: React.FC<RequireAuthProps> = ({ children, roles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to={authStorage.getRedirectPath(user.role)} replace />;
  }

  return <>{children}</>;
};

/** Login/signup only — logged-in users must logout before seeing these pages. */
export const GuestOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    console.log('GuestOnly: already logged in — redirecting away from login');
    return <Navigate to={authStorage.getRedirectPath(user.role)} replace />;
  }

  return <>{children}</>;
};
