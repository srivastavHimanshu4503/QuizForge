import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { NetworkProvider } from './context/NetworkContext';
import { AudioProvider } from './context/AudioContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { RouteLoadingFallback } from './components/common/RouteLoadingFallback';

// Lazily imported routes for efficient code-splitting and rapid initial paint (CWV / LCP)
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const QuizPlayerPage = lazy(() => import('./pages/QuizPlayerPage').then((m) => ({ default: m.QuizPlayerPage })));
const QuizResultsPage = lazy(() => import('./pages/QuizResultsPage').then((m) => ({ default: m.QuizResultsPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const CodeQuizPlayerPage = lazy(() => import('./pages/CodeQuizPlayerPage').then((m) => ({ default: m.CodeQuizPlayerPage })));
const CodeQuizResultsPage = lazy(() => import('./pages/CodeQuizResultsPage').then((m) => ({ default: m.CodeQuizResultsPage })));
const ClassroomsPage = lazy(() => import('./pages/ClassroomsPage').then((m) => ({ default: m.ClassroomsPage })));
const StudentAssignmentsPage = lazy(() => import('./pages/StudentAssignmentsPage').then((m) => ({ default: m.StudentAssignmentsPage })));
const QuizStudioPage = lazy(() => import('./pages/QuizStudioPage').then((m) => ({ default: m.QuizStudioPage })));
const SharedQuizLandingPage = lazy(() => import('./pages/SharedQuizLandingPage').then((m) => ({ default: m.SharedQuizLandingPage })));
const VerifyCertificatePage = lazy(() => import('./pages/VerifyCertificatePage').then((m) => ({ default: m.VerifyCertificatePage })));
const ArenaJoinPage = lazy(() => import('./pages/ArenaJoinPage').then((m) => ({ default: m.ArenaJoinPage })));
const ArenaPlayerPage = lazy(() => import('./pages/ArenaPlayerPage').then((m) => ({ default: m.ArenaPlayerPage })));
const ArenaHostPage = lazy(() => import('./pages/ArenaHostPage').then((m) => ({ default: m.ArenaHostPage })));
const FlashcardsPage = lazy(() => import('./pages/FlashcardsPage').then((m) => ({ default: m.FlashcardsPage })));
const FlashcardStudyPage = lazy(() => import('./pages/FlashcardStudyPage').then((m) => ({ default: m.FlashcardStudyPage })));
const HeatmapPage = lazy(() => import('./pages/HeatmapPage').then((m) => ({ default: m.HeatmapPage })));
const StudyLobbyPage = lazy(() => import('./pages/StudyLobbyPage').then((m) => ({ default: m.StudyLobbyPage })));
const StudyRoomPage = lazy(() => import('./pages/StudyRoomPage').then((m) => ({ default: m.StudyRoomPage })));

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <NetworkProvider>
          <AuthProvider>
            <AudioProvider>
              <Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/verify/:code?" element={<VerifyCertificatePage />} />
                  <Route path="/verify" element={<VerifyCertificatePage />} />
                  <Route path="/arena" element={<ArenaJoinPage />} />
                  <Route path="/arena/join" element={<ArenaJoinPage />} />
                  <Route path="/arena/play/:pin" element={<ArenaPlayerPage />} />
                  <Route
                    path="/arena/host/:pin"
                    element={
                      <ProtectedRoute>
                        <ArenaHostPage />
                      </ProtectedRoute>
                    }
                  />
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
                  <Route
                    path="/flashcards"
                    element={
                      <ProtectedRoute>
                        <FlashcardsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/flashcards/study/:deckId"
                    element={
                      <ProtectedRoute>
                        <FlashcardStudyPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/heatmap"
                    element={
                      <ProtectedRoute>
                        <HeatmapPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/analytics"
                    element={
                      <ProtectedRoute>
                        <HeatmapPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/study"
                    element={
                      <ProtectedRoute>
                        <StudyLobbyPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/study/:roomIdOrCode"
                    element={
                      <ProtectedRoute>
                        <StudyRoomPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </AudioProvider>
          </AuthProvider>
        </NetworkProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
