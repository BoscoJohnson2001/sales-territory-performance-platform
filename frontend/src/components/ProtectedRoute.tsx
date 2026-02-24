import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ReactNode } from 'react';

const ROLE_HOME: Record<string, string> = {
  ADMIN: '/admin/dashboard', MANAGEMENT: '/management/dashboard', SALES: '/sales/dashboard',
};

interface Props { children: ReactNode; roles: string[]; }

export default function ProtectedRoute({ children, roles }: Props) {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div className="flex items-center justify-center h-screen bg-bg-base">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
  return <>{children}</>;
}
