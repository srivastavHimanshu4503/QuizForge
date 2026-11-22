import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { CaptchaChallenge } from '@quiz-forge/shared';
import {
  Sparkles,
  AlertCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Eye,
  EyeOff,
  Quote,
  CheckCircle2,
} from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
      fetchCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = formError || error;

  return (
    <div className="min-h-screen flex bg-[#F8F9FC]">
      {/* ===================== LEFT HERO PANEL (Hidden on < 1024px) ===================== */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1935CA] text-white p-12 lg:p-16 flex-col justify-between relative overflow-hidden">
        {/* Decorative corner brackets & background shapes */}
        <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-white/20 pointer-events-none" />
        <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-white/20 pointer-events-none" />
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-[#38BDF8]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Branding */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-full bg-white text-[#1935CA] flex items-center justify-center font-black shadow-lg">
            <Sparkles className="w-5 h-5 fill-[#1935CA]" />
          </div>
          <div>
            <span className="font-extrabold text-2xl tracking-tight text-white block">
              QuizForge
            </span>
            <span className="text-xs font-semibold text-white/70 tracking-wider uppercase">
              AI Code Review & Assessment
            </span>
          </div>
        </div>

        {/* Center Quote & Editorial Focus */}
        <div className="relative z-10 my-auto py-12 max-w-lg">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-[#38BDF8] mb-6 shadow-inner">
            <Quote className="w-6 h-6 fill-[#38BDF8]/20" />
          </div>
          <blockquote className="text-2xl sm:text-3xl font-bold text-white leading-snug tracking-tight mb-6">
            "Mastering software is not about memorizing syntax, it's about defending every architectural choice and understanding every line of code."
          </blockquote>
          <p className="text-sm font-semibold text-white/80 tracking-wide uppercase">
            — QuizForge Engineering Rubric
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4 pt-8 border-t border-white/10 text-xs">
            <div className="flex items-center gap-2 text-white/90">
              <CheckCircle2 className="w-4 h-4 text-[#38BDF8]" />
              <span>Multi-LLM Inference</span>
            </div>
            <div className="flex items-center gap-2 text-white/90">
              <CheckCircle2 className="w-4 h-4 text-[#38BDF8]" />
              <span>Adversarial Code Review</span>
            </div>
            <div className="flex items-center gap-2 text-white/90">
              <CheckCircle2 className="w-4 h-4 text-[#38BDF8]" />
              <span>Anti-Cheat Real-time Guard</span>
            </div>
            <div className="flex items-center gap-2 text-white/90">
              <CheckCircle2 className="w-4 h-4 text-[#38BDF8]" />
              <span>Classroom RBAC Workflows</span>
            </div>
          </div>
        </div>

        {/* Bottom Metadata */}
        <div className="text-xs text-white/60 relative z-10">
          © 2026 QuizForge Technologies. Enterprise Assessment Platform.
        </div>
      </div>

      {/* ===================== RIGHT AUTH FORM PANEL ===================== */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 min-h-screen">
        <div className="w-full max-w-[420px] bg-white rounded-[20px] p-8 sm:p-10 shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100/80">
          {/* Header */}
          <div className="mb-8">
            <div className="lg:hidden flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#1935CA] text-white flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-xl text-[#1935CA]">QuizForge</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1935CA] tracking-tight">
              Login to your Account
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-[#696F79] font-medium">
              Welcome back! Select a demo role or enter your credentials.
            </p>
          </div>

          {/* Quick Demo Credentials */}
          <div className="mb-6 p-4 rounded-xl bg-[#F8F9FC] border border-slate-100 text-xs">
            <div className="font-bold text-[#1E293B] mb-2.5 flex items-center justify-between">
              <span>Quick-Fill Demo Roles</span>
              <span className="text-[10px] text-[#1935CA] font-mono font-bold bg-[#EEF2FF] px-2 py-0.5 rounded-full">
                QuizForge2026!
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail('teacher@quizforge.dev');
                  setPassword('QuizForge2026!');
                  setFormError(null);
                }}
                className="px-3 py-2 rounded-lg bg-white hover:bg-[#EEF2FF] text-[#1935CA] border border-slate-200/80 hover:border-[#1935CA]/30 text-center font-bold shadow-sm transition active:scale-98"
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
                className="px-3 py-2 rounded-lg bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200/80 hover:border-emerald-300 text-center font-bold shadow-sm transition active:scale-98"
              >
                Student (Learner)
              </button>
            </div>
          </div>

          {displayError && (
            <div className="mb-6 p-3.5 rounded-xl bg-[#FEF2F2] border border-rose-200 flex items-start gap-2.5 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold text-[#1E293B] mb-1.5"
              >
                Email address*
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full px-4 py-3 rounded-xl bg-white text-[#1E293B] placeholder-[#94A3B8] text-sm shadow-[0_4px_16px_rgba(15,23,42,0.05)] border-0 focus:ring-2 focus:ring-[#1935CA] transition outline-none font-medium"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold text-[#1E293B] mb-1.5"
              >
                Enter password*
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-white text-[#1E293B] placeholder-[#94A3B8] text-sm shadow-[0_4px_16px_rgba(15,23,42,0.05)] border-0 focus:ring-2 focus:ring-[#1935CA] transition outline-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94A3B8] hover:text-[#1E293B] transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* CAPTCHA Security Challenge */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="captcha"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E293B]"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#1935CA]" />
                  <span>Security Verification*</span>
                </label>
                <button
                  type="button"
                  onClick={fetchCaptcha}
                  disabled={isLoadingCaptcha}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1935CA] hover:underline disabled:opacity-50"
                  title="Reload challenge"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingCaptcha ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-3.5 py-2.5 rounded-xl bg-[#EEF2FF] text-[#1935CA] font-mono font-bold tracking-wider text-sm select-none whitespace-nowrap min-w-[120px] text-center shadow-inner">
                  {isLoadingCaptcha ? '...' : (captcha?.question || 'Solve challenge')}
                </div>
                <input
                  id="captcha"
                  type="text"
                  required
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  placeholder="Enter answer"
                  className="w-full px-4 py-2.5 rounded-xl bg-white text-[#1E293B] placeholder-[#94A3B8] text-sm shadow-[0_4px_16px_rgba(15,23,42,0.05)] border-0 focus:ring-2 focus:ring-[#1935CA] transition outline-none font-medium"
                />
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs font-medium text-[#696F79] cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-[#1935CA] focus:ring-[#1935CA] w-4 h-4"
                />
                <span>Remember my password</span>
              </label>
              <a
                href="#forgot"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Use the quick-fill buttons above to log in with demo accounts.');
                }}
                className="text-xs font-bold text-[#1935CA] hover:underline"
              >
                Forgot Password?
              </a>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-[#1935CA] hover:bg-[#142BA3] text-white shadow-[0_8px_20px_rgba(25,53,202,0.22)] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 mt-2 active:scale-98"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <span className="relative px-3 bg-white text-xs text-[#94A3B8] uppercase font-bold tracking-wider">
              or
            </span>
          </div>

          {/* Bottom link */}
          <div className="text-center">
            <p className="text-xs font-medium text-[#696F79]">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-bold text-[#1935CA] hover:underline"
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
