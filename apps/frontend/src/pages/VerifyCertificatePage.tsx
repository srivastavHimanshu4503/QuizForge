import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CertificateVerificationDto } from '@quiz-forge/shared';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Award,
  Sparkles,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export function VerifyCertificatePage() {
  const { code: routeCode } = useParams<{ code?: string }>();
  const [searchInput, setSearchInput] = useState(routeCode || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CertificateVerificationDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const performVerification = async (targetCode: string) => {
    if (!targetCode.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSearched(true);

    try {
      const res = await fetch(`/api/certificates/verify/${encodeURIComponent(targetCode.trim())}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Certificate verification failed.');
      }
      setResult(json.data);
    } catch (err: any) {
      setError(err.message || 'Invalid or unrecognized certificate code.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (routeCode) {
      setSearchInput(routeCode);
      performVerification(routeCode);
    }
  }, [routeCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performVerification(searchInput);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B1120] text-[#1E293B] dark:text-[#F8FAFC] flex flex-col transition-colors duration-200">
      {/* Top Navigation */}
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
                Credential Verification
              </span>
            </div>
          </Link>

          <Link
            to="/login"
            className="flex items-center gap-1.5 text-xs font-bold text-[#1935CA] dark:text-[#38BDF8] hover:underline"
          >
            <span>Log In to QuizForge</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col justify-center">
        <div className="text-center space-y-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1935CA]/10 dark:bg-[#38BDF8]/10 text-[#1935CA] dark:text-[#38BDF8] text-xs font-bold">
            <Award className="w-3.5 h-3.5" />
            <span>Official Examination Verification Registry</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1E293B] dark:text-white">
            Verify Certificate of Achievement
          </h1>
          <p className="text-sm text-[#696F79] dark:text-slate-400 max-w-lg mx-auto">
            Validate the authenticity, recipient identity, score honors, and issue date of any QuizForge certificate.
          </p>
        </div>

        {/* Verification Input Form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="relative flex items-center shadow-lg shadow-[#1935CA]/5 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-800 p-2">
            <Search className="w-5 h-5 text-slate-400 ml-3 mr-2 shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="e.g. QF-2026-A1B2C3D4"
              className="w-full bg-transparent px-2 py-2.5 text-sm font-semibold outline-none text-[#1E293B] dark:text-white placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={loading || !searchInput.trim()}
              className="shrink-0 px-6 py-2.5 rounded-xl bg-[#1935CA] hover:bg-[#142BA3] disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-[#1935CA]/20 transition flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>Verify</span>
            </button>
          </div>
        </form>

        {/* Verification Result Card */}
        {result && (
          <div className="rounded-[24px] bg-white dark:bg-[#151C2C] border-2 border-emerald-500/30 dark:border-emerald-500/40 p-6 sm:p-8 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Emerald Header Accent */}
            <div className="flex items-center gap-3.5 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                    ✓ Verified Authentic
                  </span>
                  {result.isDistinction && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      High Distinction
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-[#1E293B] dark:text-[#F8FAFC] mt-0.5">
                  Official QuizForge Credential
                </h2>
              </div>
            </div>

            {/* Credential Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 py-6">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#696F79] dark:text-slate-400">
                  Recipient Name
                </span>
                <p className="text-base font-extrabold text-[#1935CA] dark:text-[#38BDF8] mt-0.5">
                  {result.recipientName}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#696F79] dark:text-slate-400">
                  Assessment Topic
                </span>
                <p className="text-sm font-bold text-[#1E293B] dark:text-white mt-0.5">
                  {result.quizTitle}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#696F79] dark:text-slate-400">
                  Score & Evaluation Honors
                </span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {result.score} / {result.totalQuestions} ({result.percentage}%) • {result.grade}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#696F79] dark:text-slate-400">
                  Date of Certification
                </span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {new Date(result.issuedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {/* Credential Seal & Security Box */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-[#696F79] dark:text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Verification Code: <strong className="font-mono text-slate-800 dark:text-slate-200">{result.verificationCode}</strong></span>
              </div>
              <span className="text-[11px] font-medium">
                Cryptographically registered on QuizForge Examination Records.
              </span>
            </div>
          </div>
        )}

        {/* Error / Not Found Alert */}
        {error && searched && (
          <div className="rounded-[24px] bg-white dark:bg-[#151C2C] border-2 border-rose-500/30 dark:border-rose-500/40 p-6 sm:p-8 shadow-xl text-center space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400">
              Certificate Not Found or Unverified
            </h3>
            <p className="text-xs text-[#696F79] dark:text-slate-400 max-w-md mx-auto">
              {error} Please verify the verification code from the bottom of your certificate and try again.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
