import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/AuthContext';
import AccountingLayout from './layouts/AccountingLayout';
import ExpensesPage from './pages/ExpensesPage';
import IncomePage from './pages/IncomePage';
import LoginPage from './pages/LoginPage';
import LogbookPage from './pages/LogbookPage';
import UsersPage from './pages/UsersPage';

function ProtectedRoute({ children }) {
  const { isLoggedIn, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <div className="accounting-loading">Checking session...</div>;
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route
        element={
          <ProtectedRoute>
            <AccountingLayout />
          </ProtectedRoute>
        }
      >
        <Route element={<IncomePage />} index />
        <Route element={<ExpensesPage />} path="expenses" />
        <Route element={<LogbookPage />} path="logbook" />
        <Route element={<UsersPage />} path="users" />
      </Route>
      <Route element={<Navigate to="/" replace />} path="*" />
    </Routes>
  );
}
