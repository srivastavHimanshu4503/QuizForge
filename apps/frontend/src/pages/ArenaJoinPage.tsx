import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient, ApiError } from '../api/client';
import { Swords, ArrowRight, Loader2, Sparkles, Gamepad2, Shield } from 'lucide-react';

export function ArenaJoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pin, setPin] = useState(searchParams.get('pin') || '');
  const [nickname, setNickname] = useState(user?.displayName || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || !nickname.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiClient.post<{
        sessionId: string;
        pin: string;
        participantId: string;
        nickname: string;
        status: string;
      }>('/api/arena/join', {
        pin: pin.trim(),
        nickname: nickname.trim(),
      });

      // Save participant session in localStorage
      localStorage.setItem(`arena_part_${res.pin}`, res.participantId);
      localStorage.setItem(`arena_nick_${res.pin}`, res.nickname);

      navigate(
        `/arena/play/${res.pin}?participantId=${res.participantId}&nickname=${encodeURIComponent(
          res.nickname
        )}`
      );
    } catch (err: unknown) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to join game room. Please check the PIN.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B1120] text-[#1E293B] dark:text-[#F8FAFC] flex flex-col justify-between transition-colors duration-200">
      {/* Top Header */}
      <header className="border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1935CA] text-white flex items-center justify-center font-bold text-lg shadow-md shadow-[#1935CA]/20">
              Q
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-[#1E293B] dark:text-white">
                Quiz<span className="text-[#1935CA] dark:text-[#38BDF8]">Forge</span>
              </span>
              <span className="text-[10px] text-[#696F79] dark:text-slate-400 font-semibold uppercase tracking-wider -mt-1">
                Live Arena
              </span>
            </div>
          </Link>

          <Link
            to={user ? '/' : '/login'}
            className="flex items-center gap-1.5 text-xs font-bold text-[#1935CA] dark:text-[#38BDF8] hover:underline"
          >
            <span>{user ? 'Back to Dashboard' : 'Log In'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Form Center */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-12 flex flex-col justify-center">
        <div className="text-center space-y-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-rose-500/10 via-[#1935CA]/10 to-amber-500/10 text-[#1935CA] dark:text-[#38BDF8] text-xs font-bold border border-[#1935CA]/20 shadow-sm">
            <Swords className="w-4 h-4 text-rose-500 animate-bounce" />
            <span>Real-Time Multiplayer Battles</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#1E293B] dark:text-white">
            Join Live Arena
          </h1>
          <p className="text-xs text-[#696F79] dark:text-slate-400 max-w-xs mx-auto font-medium">
            Enter the 6-digit room PIN displayed on the host's screen to enter the battle.
          </p>
        </div>

        <div className="bg-white dark:bg-[#151C2C] rounded-[24px] p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-300 text-xs font-bold">
              {error}
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#696F79] dark:text-slate-400 mb-1.5">
                Game PIN *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  maxLength={8}
                  placeholder="e.g. 849201"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-[0.25em] font-mono text-2xl font-black px-4 py-3 rounded-2xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-[#1E293B] dark:text-white outline-none focus:ring-2 focus:ring-[#1935CA] transition shadow-inner"
                />
                <Gamepad2 className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#696F79] dark:text-slate-400 mb-1.5">
                Your Warrior Nickname *
              </label>
              <input
                type="text"
                required
                maxLength={20}
                placeholder="e.g. QuantumAce"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full text-sm font-bold px-4 py-3 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-[#1E293B] dark:text-white outline-none focus:ring-2 focus:ring-[#1935CA] transition"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !pin.trim() || !nickname.trim()}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#1935CA] to-indigo-600 hover:from-[#142BA3] hover:to-indigo-700 text-white font-extrabold text-sm shadow-lg shadow-[#1935CA]/25 transition active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              <span>Enter Arena Battle</span>
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 text-[11px] text-[#696F79] dark:text-slate-400 font-medium">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span>Fast speed + accurate answers = max score & streaks!</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-slate-400">
        QuizForge Real-Time Arena Engine • Built with WebSockets
      </footer>
    </div>
  );
}
