import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SetPasswordPage from './pages/SetPasswordPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManagementDashboard from './pages/management/ManagementDashboard';
import SalesDashboard from './pages/sales/SalesDashboard';
import MapPage from './pages/map/MapPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.PROD ? '/sales-territory-performance-platform' : '/'}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
          <Route path="/admin/dashboard"
            element={<ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/management/dashboard"
            element={<ProtectedRoute roles={['MANAGEMENT']}><ManagementDashboard /></ProtectedRoute>} />
          <Route path="/sales/dashboard"
            element={<ProtectedRoute roles={['SALES']}><SalesDashboard /></ProtectedRoute>} />
          <Route path="/map"
            element={<ProtectedRoute roles={['ADMIN','MANAGEMENT','SALES']}><MapPage /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
