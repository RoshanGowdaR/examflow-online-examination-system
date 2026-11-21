import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AccountPendingPage } from './pages/AccountPendingPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { ExamAttemptPage } from './pages/ExamAttemptPage';
import { LandingPage } from './pages/LandingPage';

function FallbackRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? '/dashboard' : '/'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/account-pending" element={<AccountPendingPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/exam/:examId/attempt" element={<ExamAttemptPage />} />
      </Route>
      <Route path="*" element={<FallbackRedirect />} />
    </Routes>
  );
}
