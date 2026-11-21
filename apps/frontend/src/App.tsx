import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { QuizPlayerPage } from './pages/QuizPlayerPage';
import { QuizResultsPage } from './pages/QuizResultsPage';
import { HistoryPage } from './pages/HistoryPage';
import { CodeQuizPlayerPage } from './pages/CodeQuizPlayerPage';
import { CodeQuizResultsPage } from './pages/CodeQuizResultsPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quiz/:attemptId"
            element={
              <ProtectedRoute>
                <QuizPlayerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quiz/:attemptId/results"
            element={
              <ProtectedRoute>
                <QuizResultsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/code-quiz/:attemptId"
            element={
              <ProtectedRoute>
                <CodeQuizPlayerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/code-quiz/:attemptId/results"
            element={
              <ProtectedRoute>
                <CodeQuizResultsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <HistoryPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
