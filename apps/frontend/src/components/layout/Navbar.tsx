import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Sparkles, LogOut, User, Fingerprint } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PasskeyManagementModal } from '../auth/PasskeyManagementModal';

export function Navbar() {
  const { user, logout } = useAuth();
  const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false);

  return (
    <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/20 transition">
                <Sparkles className="w-5 h-5 text-indigo-400" />
              </div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                QuizForge
              </span>
            </Link>

            {user && (
              <div className="hidden sm:flex items-center gap-1 text-xs font-semibold">
                <Link
                  to="/"
                  className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
                >
                  Dashboard
                </Link>
                <Link
                  to="/classrooms"
                  className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
                >
                  Classrooms
                </Link>
                {user.role === 'student' && (
                  <Link
                    to="/assignments"
                    className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
                  >
                    Assignments
                  </Link>
                )}
                <Link
                  to="/study"
                  className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
                >
                  Study Rooms
                </Link>
                <Link
                  to="/flashcards"
                  className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
                >
                  Flashcards
                </Link>
                <Link
                  to="/history"
                  className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
                >
                  History
                </Link>
              </div>
            )}
          </div>

          {user && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-slate-200 leading-none">
                      {user.displayName}
                    </p>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                        user.role === 'teacher'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : user.role === 'admin'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    {user.email}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsPasskeyModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-lg border border-slate-700/60 hover:border-slate-600 transition"
                title="Manage Passkeys and Biometric Credentials"
              >
                <Fingerprint className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span className="hidden md:inline">Passkeys</span>
              </button>

              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 bg-slate-800/60 hover:bg-rose-500/10 rounded-lg border border-slate-700/60 hover:border-rose-500/20 transition"
                title="Log out of QuizForge"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <PasskeyManagementModal
        isOpen={isPasskeyModalOpen}
        onClose={() => setIsPasskeyModalOpen(false)}
      />
    </nav>
  );
}
