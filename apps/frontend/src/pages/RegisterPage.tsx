import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { Sparkles, AlertCircle, Loader2, Quote, CheckCircle2 } from 'lucide-react';

export function RegisterPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, error, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (displayName.trim().length < 2) {
      setFormError('Display name must be at least 2 characters.');
      return;
    }

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match. Please verify.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        role,
      });
      navigate('/', { replace: true });
    } catch {
      // Error handled by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = formError || error;

  return (
    <div className="min-h-screen flex bg-[#F8F9FC] dark:bg-[#0B0F19] text-[#1E293B] dark:text-[#F8FAFC] relative transition-colors duration-200">
      {/* Floating Theme Toggle in top-right */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle showMenu />
      </div>

      {/* ===================== LEFT HERO PANEL (Hidden on < 1024px) ===================== */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1935CA] text-white p-12 lg:p-16 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-white/20 pointer-events-none" />
        <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-white/20 pointer-events-none" />
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-[#38BDF8]/10 rounded-full blur-3xl pointer-events-none" />

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

        <div className="relative z-10 my-auto py-12 max-w-lg">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-[#38BDF8] mb-6 shadow-inner">
            <Quote className="w-6 h-6 fill-[#38BDF8]/20" />
          </div>
          <blockquote className="text-2xl sm:text-3xl font-bold text-white leading-snug tracking-tight mb-6">
            "Accelerate your learning loop with real-time adversarial evaluations and deep conceptual mastery."
          </blockquote>
          <p className="text-sm font-semibold text-white/80 tracking-wide uppercase">
            — QuizForge Learning Platform
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4 pt-8 border-t border-white/10 text-xs">
            <div className="flex items-center gap-2 text-white/90">
              <CheckCircle2 className="w-4 h-4 text-[#38BDF8]" />
              <span>Multi-LLM Inference</span>
            </div>
            <div className="flex items-center gap-2 text-white/90">
              <CheckCircle2 className="w-4 h-4 text-[#38BDF8]" />
              <span>Instant AI Rubrics</span>
            </div>
            <div className="flex items-center gap-2 text-white/90">
              <CheckCircle2 className="w-4 h-4 text-[#38BDF8]" />
              <span>Zero-AI Retakes</span>
            </div>
            <div className="flex items-center gap-2 text-white/90">
              <CheckCircle2 className="w-4 h-4 text-[#38BDF8]" />
              <span>Classroom Workflows</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-white/60 relative z-10">
          © 2026 QuizForge Technologies. Enterprise Assessment Platform.
        </div>
      </div>

      {/* ===================== RIGHT REGISTER FORM PANEL ===================== */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 min-h-screen">
        <div className="w-full max-w-[420px] bg-white dark:bg-[#151C2C] rounded-[20px] p-8 sm:p-10 shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100/80 dark:border-slate-800 transition-colors duration-200">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1935CA] dark:text-[#38BDF8] tracking-tight">
              Create an Account
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-[#696F79] dark:text-slate-400 font-medium">
              Join QuizForge to generate and attempt AI assessments.
            </p>
          </div>

          {displayError && (
            <div className="mb-5 p-3.5 rounded-xl bg-[#FEF2F2] dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 flex items-start gap-2.5 text-rose-700 dark:text-rose-400 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Toggle */}
            <div>
              <label className="block text-xs font-bold text-[#1E293B] dark:text-slate-200 mb-1.5">
                I am registering as:
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#F8F9FC] dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`py-2 text-xs font-bold rounded-lg transition ${
                    role === 'student'
                      ? 'bg-[#1935CA] text-white shadow-sm'
                      : 'text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white'
                  }`}
                >
                  Student (Learner)
                </button>
                <button
                  type="button"
                  onClick={() => setRole('teacher')}
                  className={`py-2 text-xs font-bold rounded-lg transition ${
                    role === 'teacher'
                      ? 'bg-[#1935CA] text-white shadow-sm'
                      : 'text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white'
                  }`}
                >
                  Teacher (Instructor)
                </button>
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-xs font-bold text-[#1E293B] dark:text-slate-200 mb-1.5">
                Full Name*
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex Mercer"
                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#1E293B] text-[#1E293B] dark:text-[#F8FAFC] placeholder-[#94A3B8] dark:placeholder-slate-500 text-sm shadow-[0_4px_16px_rgba(15,23,42,0.05)] border border-slate-200/60 dark:border-slate-700 focus:ring-2 focus:ring-[#1935CA] transition outline-none font-medium"
              />
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-bold text-[#1E293B] dark:text-slate-200 mb-1.5">
                Email address*
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#1E293B] text-[#1E293B] dark:text-[#F8FAFC] placeholder-[#94A3B8] dark:placeholder-slate-500 text-sm shadow-[0_4px_16px_rgba(15,23,42,0.05)] border border-slate-200/60 dark:border-slate-700 focus:ring-2 focus:ring-[#1935CA] transition outline-none font-medium"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-[#1E293B] dark:text-slate-200 mb-1.5">
                Password*
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#1E293B] text-[#1E293B] dark:text-[#F8FAFC] placeholder-[#94A3B8] dark:placeholder-slate-500 text-sm shadow-[0_4px_16px_rgba(15,23,42,0.05)] border border-slate-200/60 dark:border-slate-700 focus:ring-2 focus:ring-[#1935CA] transition outline-none font-medium"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-bold text-[#1E293B] dark:text-slate-200 mb-1.5">
                Confirm Password*
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#1E293B] text-[#1E293B] dark:text-[#F8FAFC] placeholder-[#94A3B8] dark:placeholder-slate-500 text-sm shadow-[0_4px_16px_rgba(15,23,42,0.05)] border border-slate-200/60 dark:border-slate-700 focus:ring-2 focus:ring-[#1935CA] transition outline-none font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-[#1935CA] hover:bg-[#142BA3] text-white shadow-[0_8px_20px_rgba(25,53,202,0.22)] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 mt-4 active:scale-98"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Register</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-xs font-medium text-[#696F79] dark:text-slate-400">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-[#1935CA] dark:text-[#38BDF8] hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
