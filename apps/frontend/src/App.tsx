import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
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
import { ClassroomsPage } from './pages/ClassroomsPage';
import { StudentAssignmentsPage } from './pages/StudentAssignmentsPage';
import { QuizStudioPage } from './pages/QuizStudioPage';
import { SharedQuizLandingPage } from './pages/SharedQuizLandingPage';

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
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
            path="/classrooms"
            element={
              <ProtectedRoute>
                <ClassroomsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assignments"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentAssignmentsPage />
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
          <Route
            path="/studio/:quizId"
            element={
              <ProtectedRoute>
                <QuizStudioPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quiz/shared/:shareCode"
            element={
              <ProtectedRoute>
                <SharedQuizLandingPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);
}
