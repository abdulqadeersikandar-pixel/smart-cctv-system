import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './hooks/useAuth';

const Login = lazy(() => import('./pages/Login'));
const CameraStream = lazy(() => import('./pages/CameraStream'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

function HomeRoute() {
  const { currentUser } = useAuth();
  return <Navigate to={currentUser ? '/dashboard' : '/login'} replace />;
}

function App() {
  return (
    <Router>
      <Suspense fallback={<div className="min-h-screen bg-dark-900 text-gray-200 flex items-center justify-center">Loading...</div>}>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/login" element={<Login />} />
          <Route path="/stream" element={<CameraStream />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;