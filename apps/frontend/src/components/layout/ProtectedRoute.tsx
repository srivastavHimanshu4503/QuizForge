import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children?: ReactNode;
  allowedRoles?: string[];
}) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#1935CA] animate-spin mb-3" />
        <p className="text-[#696F79] text-sm font-medium">Authenticating session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'teacher' || user.role === 'admin') {
      return <Navigate to="/classrooms" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : null;
}
