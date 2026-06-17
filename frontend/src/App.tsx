import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import CourierPage from './pages/CourierPage';
import RecipientPage from './pages/RecipientPage';
import AdminPage from './pages/AdminPage';
import Layout from './components/Layout';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /><span>加载中...</span></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><div className="spinner" /><span>加载中...</span></div>;
  if (!user) return <Navigate to="/login" replace />;
  switch (user.role) {
    case 'courier': return <Navigate to="/courier" replace />;
    case 'recipient': return <Navigate to="/recipient" replace />;
    case 'admin': return <Navigate to="/admin" replace />;
    default: return <Navigate to="/login" replace />;
  }
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/courier" element={<ProtectedRoute roles={['courier', 'admin']}><Layout><CourierPage /></Layout></ProtectedRoute>} />
      <Route path="/recipient" element={<ProtectedRoute roles={['recipient']}><Layout><RecipientPage /></Layout></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute roles={['admin']}><Layout><AdminPage /></Layout></ProtectedRoute>} />
      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
