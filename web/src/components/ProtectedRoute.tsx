import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function ProtectedRoute() {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" />Checking your account…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <Navigate to="/account-pending" replace />;
  return <Outlet />;
}
