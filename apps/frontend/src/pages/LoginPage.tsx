import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { CaptchaChallenge } from '@quiz-forge/shared';
import { Sparkles, Lock, Mail, AlertCircle, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [isLoadingCaptcha, setIsLoadingCaptcha] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const fetchCaptcha = useCallback(async () => {
    setIsLoadingCaptcha(true);
    try {
      const data = await apiClient.get<CaptchaChallenge>('/api/auth/captcha');
      setCaptcha(data);
      setCaptchaAnswer('');
    } catch {
      // In case captcha cannot be reached, user will see error on submit
    } finally {
      setIsLoadingCaptcha(false);
    }
  }, []);

  useEffect(() => {
    fetchCaptcha();
  }, [fetchCaptcha]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!email.trim() || !password) {
      setFormError('Please enter both your email address and password.');
      return;
    }

    if (!captchaAnswer.trim()) {
      setFormError('Please solve the security challenge before signing in.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({
        email,
        password,
        captchaId: captcha?.captchaId,
        captchaAnswer: captchaAnswer.trim(),
      });
      navigate(from, { replace: true });
    } catch {
      // Refresh captcha on failed attempt
      fetchCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = formError || error;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Sign in to QuizForge
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Generate and attempt personalized AI-powered MCQ quizzes
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          {/* Quick Demo Credentials */}
          <div className="mb-6 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300">
            <div className="font-semibold text-slate-200 mb-2 flex items-center justify-between">
              <span>Demo Accounts (Click to Fill)</span>
              <span className="text-[10px] text-cyan-400 font-mono">Pass: QuizForge2026!</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail('teacher@quizforge.dev');
                  setPassword('QuizForge2026!');
                  setFormError(null);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-center font-medium transition"
              >
                Teacher (Instructor)
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('student@quizforge.dev');
                  setPassword('QuizForge2026!');
                  setFormError(null);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-center font-medium transition"
              >
                Student (Learner)
              </button>
            </div>
          </div>

          {displayError && (
            <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-3 text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* CAPTCHA Security Challenge */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="captcha"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Security Verification</span>
                </label>
                <button
                  type="button"
                  onClick={fetchCaptcha}
                  disabled={isLoadingCaptcha}
                  className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition disabled:opacity-50"
                  title="Reload challenge"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCaptcha ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-indigo-500/30 text-indigo-300 font-mono font-bold tracking-wide text-sm select-none whitespace-nowrap min-w-[130px] text-center shadow-inner">
                  {isLoadingCaptcha ? '...' : (captcha?.question || 'Solve challenge')}
                </div>
                <input
                  id="captcha"
                  type="text"
                  required
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  placeholder="Answer"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-medium text-indigo-400 hover:text-indigo-300 transition"
              >
                Create one now
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
