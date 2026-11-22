import { useState, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CodeQuizModal } from '../code-quiz/CodeQuizModal';
import { GenerateQuizModal } from '../quiz/GenerateQuizModal';
import { ThemeToggle } from '../common/ThemeToggle';
import { NetworkStatusBar } from '../common/NetworkStatusBar';
import {
  LayoutDashboard,
  Code2,
  FileQuestion,
  History,
  GraduationCap,
  LogOut,
  Search,
  Sparkles,
  Menu,
  X,
  Play,
  ChevronRight,
  BookOpen,
  Swords,
  Layers,
} from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
  activeNav?: 'dashboard' | 'code-review' | 'mcq' | 'history' | 'classrooms' | 'assignments' | 'arena' | 'flashcards';
}

export function AppLayout({ children, activeNav }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [isMcqModalOpen, setIsMcqModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Determine active item from prop or pathname
  const currentPath = location.pathname;
  const isDashboard = activeNav === 'dashboard' || currentPath === '/';
  const isHistory = activeNav === 'history' || currentPath === '/history';
  const isClassrooms = activeNav === 'classrooms' || currentPath === '/classrooms';
  const isAssignments = activeNav === 'assignments' || currentPath === '/assignments';
  const isArena = activeNav === 'arena' || currentPath.startsWith('/arena');
  const isFlashcards = activeNav === 'flashcards' || currentPath.startsWith('/flashcards');

  const userInitials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'QF';

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/history?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0F19] text-[#1E293B] dark:text-[#F8FAFC] flex flex-col lg:flex-row antialiased transition-colors duration-200">
      {/* ===================== DESKTOP SIDEBAR ===================== */}
      <aside className="hidden lg:flex w-[240px] shrink-0 bg-white dark:bg-[#151C2C] h-screen sticky top-0 flex-col justify-between p-5 border-r border-slate-100 dark:border-slate-800 z-30 shadow-[0_4px_24px_rgba(15,23,42,0.02)] transition-colors duration-200">
        <div className="flex flex-col gap-6">
          {/* Brand Header */}
          <Link to="/" className="flex items-center gap-3 px-1 py-1 group">
            <div className="w-10 h-10 rounded-full bg-[#1935CA] flex items-center justify-center text-white shadow-[0_6px_16px_rgba(25,53,202,0.3)] transition-transform group-hover:scale-105">
              <Sparkles className="w-5 h-5 fill-white/20" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-[#1935CA] dark:text-[#38BDF8] block leading-tight">
                QuizForge
              </span>
              <span className="text-[10px] font-semibold text-[#696F79] dark:text-slate-400 tracking-wider uppercase block">
                AI Assessment
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5 pt-2">
            <Link
              to="/"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                isDashboard
                  ? 'bg-[#1935CA] text-white shadow-[0_8px_20px_rgba(25,53,202,0.22)]'
                  : 'text-[#696F79] dark:text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] hover:bg-[#F8F9FC] dark:hover:bg-slate-800/60'
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 ${isDashboard ? 'text-white' : 'text-[#696F79] dark:text-slate-400'}`} />
              <span>Dashboard</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsCodeModalOpen(true)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-[#696F79] dark:text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] hover:bg-[#F8F9FC] dark:hover:bg-slate-800/60 transition-all text-left"
            >
              <Code2 className="w-4 h-4 text-[#696F79] dark:text-slate-400" />
              <span>GitHub Review</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMcqModalOpen(true)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-[#696F79] dark:text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] hover:bg-[#F8F9FC] dark:hover:bg-slate-800/60 transition-all text-left"
            >
              <FileQuestion className="w-4 h-4 text-[#696F79] dark:text-slate-400" />
              <span>MCQ Quizzes</span>
            </button>

            <Link
              to="/history"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                isHistory
                  ? 'bg-[#1935CA] text-white shadow-[0_8px_20px_rgba(25,53,202,0.22)]'
                  : 'text-[#696F79] dark:text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] hover:bg-[#F8F9FC] dark:hover:bg-slate-800/60'
              }`}
            >
              <History className={`w-4 h-4 ${isHistory ? 'text-white' : 'text-[#696F79] dark:text-slate-400'}`} />
              <span>Quiz History</span>
            </Link>

            <Link
              to="/classrooms"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                isClassrooms
                  ? 'bg-[#1935CA] text-white shadow-[0_8px_20px_rgba(25,53,202,0.22)]'
                  : 'text-[#696F79] dark:text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] hover:bg-[#F8F9FC] dark:hover:bg-slate-800/60'
              }`}
            >
              <GraduationCap className={`w-4 h-4 ${isClassrooms ? 'text-white' : 'text-[#696F79] dark:text-slate-400'}`} />
              <span>Classrooms</span>
            </Link>

            <Link
              to="/arena"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                isArena
                  ? 'bg-[#1935CA] text-white shadow-[0_8px_20px_rgba(25,53,202,0.22)]'
                  : 'text-[#696F79] dark:text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] hover:bg-[#F8F9FC] dark:hover:bg-slate-800/60'
              }`}
            >
              <Swords className={`w-4 h-4 ${isArena ? 'text-white' : 'text-[#696F79] dark:text-slate-400'}`} />
              <span className="flex items-center gap-1.5">
                <span>Live Arena</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold uppercase tracking-wider">
                  Live
                </span>
              </span>
            </Link>

            <Link
              to="/flashcards"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                isFlashcards
                  ? 'bg-[#1935CA] text-white shadow-[0_8px_20px_rgba(25,53,202,0.22)]'
                  : 'text-[#696F79] dark:text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] hover:bg-[#F8F9FC] dark:hover:bg-slate-800/60'
              }`}
            >
              <Layers className={`w-4 h-4 ${isFlashcards ? 'text-white' : 'text-[#696F79] dark:text-slate-400'}`} />
              <span>Flashcards</span>
            </Link>

            {user?.role === 'student' && (
              <Link
                to="/assignments"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isAssignments
                    ? 'bg-[#1935CA] text-white shadow-[0_8px_20px_rgba(25,53,202,0.22)]'
                    : 'text-[#696F79] dark:text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] hover:bg-[#F8F9FC] dark:hover:bg-slate-800/60'
                }`}
              >
                <BookOpen className={`w-4 h-4 ${isAssignments ? 'text-white' : 'text-[#696F79] dark:text-slate-400'}`} />
                <span>Assignments</span>
              </Link>
            )}
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col gap-4">
          {/* Quick-Launch Card (Adapted from Cyberverdict Support Card) */}
          <div className="bg-gradient-to-br from-[#1935CA] via-[#1F3ED4] to-[#2546F0] rounded-2xl p-4 text-white shadow-[0_10px_25px_rgba(25,53,202,0.25)] relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1 rounded-md bg-white/20">
                <Code2 className="w-3.5 h-3.5 text-white" />
              </span>
              <h4 className="font-bold text-sm tracking-tight">Code Review AI</h4>
            </div>
            <p className="text-xs text-white/80 leading-relaxed mb-3">
              Analyze any public GitHub repo with open-ended LLM evaluation.
            </p>
            <button
              type="button"
              onClick={() => setIsCodeModalOpen(true)}
              className="w-full py-2 px-3 rounded-xl bg-white text-[#1935CA] hover:bg-slate-50 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-98"
            >
              <span>Start</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Pinned Logout */}
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#696F79] hover:text-rose-600 hover:bg-rose-50 transition text-left"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* ===================== MOBILE TOP NAV (< 1024px) ===================== */}
      <header className="lg:hidden sticky top-0 z-40 bg-white dark:bg-[#151C2C] border-b border-slate-100 dark:border-slate-800 px-4 h-16 flex items-center justify-between shadow-sm transition-colors duration-200">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#1935CA] flex items-center justify-center text-white">
            <Sparkles className="w-4 h-4 fill-white/20" />
          </div>
          <span className="font-extrabold text-lg text-[#1935CA] dark:text-[#38BDF8]">QuizForge</span>
        </Link>

        <div className="flex items-center gap-2.5 shrink-0">
          <ThemeToggle size="sm" />
          <button
            type="button"
            onClick={() => setIsMcqModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1935CA] hover:bg-[#142BA3] text-white text-xs font-semibold shadow-sm active:scale-95 transition shrink-0"
          >
            <Play className="w-3 h-3 fill-white shrink-0" />
            <span className="hidden xs:inline">Start Quiz</span>
          </button>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl text-[#1E293B] dark:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex">
          <div className="w-72 bg-white dark:bg-[#151C2C] h-full p-5 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-200 border-r border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#1935CA] flex items-center justify-center text-white">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-lg text-[#1935CA] dark:text-[#38BDF8]">QuizForge</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex flex-col gap-1.5">
                <Link
                  to="/"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                    isDashboard
                      ? 'bg-[#1935CA] text-white shadow-sm'
                      : 'text-[#696F79] dark:text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] hover:bg-[#F8F9FC] dark:hover:bg-slate-800/60'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsCodeModalOpen(true);
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#696F79] dark:text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] hover:bg-[#F8F9FC] dark:hover:bg-slate-800/60 transition text-left"
                >
                  <Code2 className="w-4 h-4" />
                  <span>GitHub Review</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsMcqModalOpen(true);
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#696F79] dark:text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] hover:bg-[#F8F9FC] dark:hover:bg-slate-800/60 transition text-left"
                >
                  <FileQuestion className="w-4 h-4" />
                  <span>MCQ Quizzes</span>
                </button>
                <Link
                  to="/history"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                    isHistory
                      ? 'bg-[#1935CA] text-white shadow-sm'
                      : 'text-[#696F79] dark:text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] hover:bg-[#F8F9FC] dark:hover:bg-slate-800/60'
                  }`}
                >
                  <History className="w-4 h-4" />
                  <span>Quiz History</span>
                </Link>
                <Link
                  to="/classrooms"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                    isClassrooms
                      ? 'bg-[#1935CA] text-white shadow-sm'
                      : 'text-[#696F79] dark:text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] hover:bg-[#F8F9FC] dark:hover:bg-slate-800/60'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Classrooms</span>
                </Link>
                <Link
                  to="/arena"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                    isArena
                      ? 'bg-[#1935CA] text-white shadow-sm'
                      : 'text-[#696F79] dark:text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] hover:bg-[#F8F9FC] dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Swords className="w-4 h-4" />
                  <span>Live Arena</span>
                </Link>
                <Link
                  to="/flashcards"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                    isFlashcards
                      ? 'bg-[#1935CA] text-white shadow-sm'
                      : 'text-[#696F79] dark:text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] hover:bg-[#F8F9FC] dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Flashcards</span>
                </Link>
                {user?.role === 'student' && (
                  <Link
                    to="/assignments"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                      isAssignments
                        ? 'bg-[#1935CA] text-white shadow-sm'
                        : 'text-[#696F79] dark:text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] hover:bg-[#F8F9FC] dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Assignments</span>
                  </Link>
                )}
              </nav>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-2 text-sm font-semibold text-rose-600 hover:text-rose-500 px-3 py-2 w-full text-left"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
        </div>
      )}

      {/* ===================== MAIN CANVAS ===================== */}
      <div className="flex-1 min-w-0 flex flex-col">
        <NetworkStatusBar />
        {/* Top Header Bar */}
        <header className="h-20 px-6 sm:px-8 flex items-center justify-between sticky top-0 bg-[#F8F9FC]/90 dark:bg-[#0B0F19]/90 backdrop-blur-md z-20 transition-all">
          {/* Borderless Soft-Shadow Search */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <div className="flex items-center bg-white dark:bg-[#151C2C] border border-transparent dark:border-slate-800 rounded-xl shadow-[0_4px_16px_rgba(15,23,42,0.05)] px-4 py-2.5 w-64 sm:w-80 md:w-96 transition-all focus-within:shadow-[0_6px_20px_rgba(25,53,202,0.12)]">
              <Search className="w-4 h-4 text-[#94A3B8] dark:text-slate-400 shrink-0 mr-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search quizzes, repos, or topics..."
                className="w-full text-sm text-[#1E293B] dark:text-[#F8FAFC] placeholder-[#94A3B8] dark:placeholder-slate-500 bg-transparent outline-none font-medium"
              />
            </div>
          </form>

          {/* Right Action Controls */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Start Quiz Action Button */}
            <button
              type="button"
              onClick={() => setIsMcqModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1935CA] hover:bg-[#142BA3] text-white text-sm font-semibold shadow-[0_8px_20px_rgba(25,53,202,0.22)] transition-all active:scale-98 shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-white shrink-0" />
              <span>Start Quiz</span>
            </button>

            {/* Subtle Divider */}
            <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

            {/* Animated Theme Slider Toggle */}
            <div className="flex items-center shrink-0">
              <ThemeToggle />
            </div>

            {/* Subtle Divider */}
            <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

            {/* User Profile Badge */}
            <div className="flex items-center gap-3 pl-1 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#1935CA] to-[#38BDF8] flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                {userInitials}
              </div>
              <div className="hidden md:block text-left">
                <span className="block text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC] leading-tight">
                  {user?.displayName || 'User'}
                </span>
                <span className="block text-[10px] font-semibold text-[#1935CA] dark:text-[#38BDF8] uppercase tracking-wider">
                  {user?.role || 'Learner'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="flex-1 px-6 sm:px-8 pb-10">
          {children}
        </main>
      </div>

      {/* Shared Global Modals */}
      <CodeQuizModal isOpen={isCodeModalOpen} onClose={() => setIsCodeModalOpen(false)} />
      <GenerateQuizModal isOpen={isMcqModalOpen} onClose={() => setIsMcqModalOpen(false)} />
    </div>
  );
}
