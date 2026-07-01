import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from './useSession';

/** Redirects unauthenticated users to /login; renders the nested route otherwise. */
export default function ProtectedRoute() {
  const { isLoading, isAuthenticated } = useSession();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
