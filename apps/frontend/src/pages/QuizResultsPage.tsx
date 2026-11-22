import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AttemptResult, CertificateMetaDto } from '@quiz-forge/shared';
import { apiClient, ApiError } from '../api/client';
import { ScoreCard } from '../components/quiz/ScoreCard';
import { ReviewQuestionItem } from '../components/quiz/ReviewQuestionItem';
import { GenerateQuizModal } from '../components/quiz/GenerateQuizModal';
import { AppLayout } from '../components/layout/AppLayout';
import {
  RotateCcw,
  Sparkles,
  Loader2,
  AlertCircle,
  Filter,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Timer,
  Award,
  FileText,
  Download,
  ExternalLink,
  X,
  CheckCircle2,
} from 'lucide-react';

export function QuizResultsPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [result, setResult] = useState<AttemptResult | null>(null);
  const [certMeta, setCertMeta] = useState<CertificateMetaDto | null>(null);
  const [isDownloadingCert, setIsDownloadingCert] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isNewQuizModalOpen, setIsNewQuizModalOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'incorrect' | 'correct'>('all');

  const isTimedOut = Boolean(result?.isTimedOut || searchParams.get('timedOut') === 'true');

  const formatDuration = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  useEffect(() => {
    const fetchResults = async () => {
      if (!attemptId) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiClient.get<AttemptResult>(
          `/api/attempts/${attemptId}/results`
        );
        setResult(data);

        // Fetch certificate eligibility & meta
        const meta = await apiClient.get<CertificateMetaDto>(
          `/api/certificates/${attemptId}/meta`
        ).catch(() => null);
        if (meta) setCertMeta(meta);
      } catch (err: unknown) {
        const msg =
          err instanceof ApiError ? err.message : 'Failed to retrieve quiz results.';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [attemptId]);

  const handleDownloadCertificate = async () => {
    if (!attemptId) return;
    setIsDownloadingCert(true);
    try {
      const res = await fetch(`/api/certificates/${attemptId}/pdf`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || 'Failed to download certificate.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const topicSafe = (result?.topic || 'Quiz').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `QuizForge-Certificate-${topicSafe}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      // Refresh metadata so certificate info is cached
      const updatedMeta = await apiClient.get<CertificateMetaDto>(
        `/api/certificates/${attemptId}/meta`
      ).catch(() => null);
      if (updatedMeta) setCertMeta(updatedMeta);
    } catch (err: any) {
      alert(err.message || 'Failed to download certificate PDF.');
    } finally {
      setIsDownloadingCert(false);
    }
  };

  const handleDownloadReportCard = async () => {
    if (!attemptId) return;
    setIsDownloadingReport(true);
    try {
      const res = await fetch(`/api/certificates/${attemptId}/report-card`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || 'Failed to download report card.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const topicSafe = (result?.topic || 'Quiz').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `QuizForge-ReportCard-${topicSafe}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Failed to download report card PDF.');
    } finally {
      setIsDownloadingReport(false);
    }
  };

  const handleRestart = async () => {
    if (!result) return;
    setIsRestarting(true);
    try {
      const data = await apiClient.post<{
        quizId: string;
        attemptId: string;
        attemptNumber: number;
        totalQuestions: number;
        status: string;
      }>(`/api/quizzes/${result.quizId}/restart`);

      navigate(`/quiz/${data.attemptId}`);
    } catch (err: unknown) {
      alert(
        err instanceof ApiError
          ? err.message
          : 'Failed to restart quiz. Please try again.'
      );
      setIsRestarting(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout activeNav="mcq">
        <div className="flex flex-col items-center justify-center p-12">
          <Loader2 className="w-10 h-10 text-[#1935CA] animate-spin mb-4" />
          <h2 className="text-xl font-bold text-[#1E293B] mb-1">Evaluating Results...</h2>
          <p className="text-sm text-[#696F79]">
            Calculating score and compiling your answer review
          </p>
        </div>
      </AppLayout>
    );
  }

  if (error || !result) {
    return (
      <AppLayout activeNav="mcq">
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 mb-4 inline-flex">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-[#1E293B] mb-2">Results Unavailable</h2>
          <p className="text-sm text-[#696F79] max-w-md mb-6">
            {error || 'Unable to retrieve attempt results.'}
          </p>
          <Link
            to="/"
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#1935CA] hover:bg-[#142BA3] text-white transition shadow-lg shadow-[#1935CA]/20"
          >
            Return to Dashboard
          </Link>
        </div>
      </AppLayout>
    );
  }

  // Filter review items
  const filteredReview = result.review.filter((item) => {
    if (filterMode === 'correct') return item.is_correct;
    if (filterMode === 'incorrect') return !item.is_correct;
    return true;
  });

  return (
    <AppLayout activeNav="mcq">
      <div className="space-y-6">
        {/* Time-out Alert Banner */}
        {isTimedOut && (
          <div className="p-4 rounded-[20px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-center gap-3">
            <Timer className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <h4 className="font-bold text-xs sm:text-sm">Time Limit Reached</h4>
              <p className="text-xs opacity-90 mt-0.5">
                The allocated time for this quiz expired. Your saved answers were automatically submitted.
              </p>
            </div>
          </div>
        )}

        {/* Exam Integrity & Duration Metrics Bar */}
        {(result.timeLimitMinutes || result.durationSeconds || (result.tabSwitchCount !== undefined && result.tabSwitchCount > 0)) && (
          <div className="p-4 sm:p-5 rounded-[20px] bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 shadow-[0_10px_30px_rgba(25,53,202,0.04)] flex flex-wrap items-center justify-between gap-4 transition-colors duration-200">
            <div className="flex items-center gap-4 flex-wrap text-xs">
              {result.durationSeconds !== undefined && (
                <div className="flex items-center gap-2 text-[#696F79] dark:text-slate-400">
                  <Clock className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8]" />
                  <span>
                    Time Spent:{' '}
                    <strong className="text-[#1E293B] dark:text-[#F8FAFC]">
                      {formatDuration(result.durationSeconds)}
                    </strong>
                    {result.timeLimitMinutes ? ` (Limit: ${result.timeLimitMinutes}m)` : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {(result.tabSwitchCount ?? 0) === 0 ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Clean Integrity Session (0 Tab Switches)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-semibold">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Integrity Flag: {result.tabSwitchCount} Tab Switch(es) Logged</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Score Card */}
        <ScoreCard result={result} />

        {/* Milestone 10: Official Certificate & Performance Report Card Banner */}
        <div className="rounded-[22px] p-6 bg-gradient-to-r from-amber-500/10 via-[#1935CA]/10 to-indigo-500/10 border border-amber-500/30 dark:border-amber-500/20 shadow-[0_10px_30px_rgba(217,119,6,0.06)] flex flex-wrap items-center justify-between gap-5 transition-all">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  {result.accuracyPercentage >= 70 ? 'Certificate Unlocked' : 'Diagnostic Report Available'}
                </span>
                {result.accuracyPercentage >= 90 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#1935CA]/10 text-[#1935CA] dark:text-[#38BDF8] flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    High Distinction
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-[#1E293B] dark:text-[#F8FAFC] mt-1">
                {result.accuracyPercentage >= 70
                  ? 'Official Certificate of Achievement Earned!'
                  : 'Diagnostic Student Performance Report'}
              </h3>
              <p className="text-xs text-[#696F79] dark:text-slate-400 font-medium max-w-xl mt-0.5">
                {result.accuracyPercentage >= 70
                  ? `Congratulations! You scored ${result.accuracyPercentage}%, demonstrating verified proficiency in this subject. Download your tamper-evident certificate or study your complete diagnostic report card.`
                  : `Score 70% or higher to earn an official certificate (current: ${result.accuracyPercentage}%). In the meantime, you can download your complete diagnostic performance report card to review topic insights.`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {result.accuracyPercentage >= 70 && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadCertificate}
                  disabled={isDownloadingCert}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-md shadow-amber-600/20 transition active:scale-98 disabled:opacity-50"
                >
                  {isDownloadingCert ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Award className="w-4 h-4" />
                  )}
                  <span>Download Certificate</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCertificateModal(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC] bg-white dark:bg-[#151C2C] border border-amber-300 dark:border-amber-700/60 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 shadow-sm transition active:scale-98"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Preview & Verify</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleDownloadReportCard}
              disabled={isDownloadingReport}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-[#1935CA] dark:text-[#38BDF8] bg-white dark:bg-[#151C2C] border border-[#1935CA]/30 dark:border-[#38BDF8]/30 hover:bg-[#1935CA]/5 dark:hover:bg-[#38BDF8]/10 shadow-sm transition active:scale-98 disabled:opacity-50"
            >
              {isDownloadingReport ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span>Report Card (PDF)</span>
            </button>
          </div>
        </div>

        {/* Action Callout Bar */}
        <div className="bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 rounded-[20px] p-6 sm:p-7 shadow-[0_10px_30px_rgba(25,53,202,0.05)] flex flex-wrap items-center justify-between gap-4 transition-colors duration-200">
          <div>
            <h3 className="text-lg font-bold text-[#1E293B] dark:text-[#F8FAFC] mb-1">
              Ready for your next challenge?
            </h3>
            <p className="text-xs text-[#696F79] dark:text-slate-400 font-medium">
              Retake this quiz with questions in a shuffled order (zero AI calls), or generate a new quiz.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRestart}
              disabled={isRestarting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#1935CA] hover:bg-[#142BA3] text-white shadow-md shadow-[#1935CA]/20 transition disabled:opacity-50"
            >
              {isRestarting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              <span>Restart Quiz (Shuffled)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsNewQuizModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-[#151C2C] hover:bg-slate-50 dark:hover:bg-slate-800 text-[#1E293B] dark:text-[#F8FAFC] border border-slate-200/80 dark:border-slate-700 shadow-sm transition"
            >
              <Sparkles className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8]" />
              <span>Generate Another Quiz</span>
            </button>
          </div>
        </div>

        {/* Review Section */}
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-2xl font-bold text-[#1E293B] dark:text-[#F8FAFC] tracking-tight">
                Answer-by-Answer Review
              </h2>
              <p className="text-xs text-[#696F79] dark:text-slate-400 mt-0.5 font-medium">
                Inspect your selections alongside correct answers and explanations
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-700 text-xs shadow-sm">
              <Filter className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  filterMode === 'all'
                    ? 'bg-[#1935CA] text-white shadow-sm'
                    : 'text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white'
                }`}
              >
                All ({result.review.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('incorrect')}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  filterMode === 'incorrect'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white'
                }`}
              >
                Missed ({result.incorrectCount + result.unansweredCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('correct')}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  filterMode === 'correct'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white'
                }`}
              >
                Correct ({result.correctCount})
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {filteredReview.map((item, idx) => (
              <ReviewQuestionItem
                key={item.question_id}
                questionNumber={idx + 1}
                review={item}
              />
            ))}

            {filteredReview.length === 0 && (
              <div className="p-8 rounded-[20px] bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 shadow-[0_10px_30px_rgba(25,53,202,0.05)] text-center text-[#696F79] dark:text-slate-400 text-sm">
                No questions matching the selected filter.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Certificate Preview Modal */}
      {showCertificateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#151C2C] rounded-[24px] p-6 sm:p-8 w-full max-w-2xl shadow-2xl space-y-6 border border-slate-100 dark:border-slate-800 transition-colors duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Award className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-lg font-bold text-[#1E293B] dark:text-[#F8FAFC]">
                  Certificate of Achievement Preview
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCertificateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Simulated Vector Certificate Preview Frame */}
            <div className="relative p-6 sm:p-8 rounded-2xl border-4 border-[#1935CA] dark:border-[#38BDF8] bg-[#FDFEFE] dark:bg-[#0B1120] text-center space-y-4 shadow-inner">
              <div className="border border-amber-500/80 rounded-xl p-6 sm:p-7 space-y-4">
                <span className="text-[10px] font-black tracking-widest text-[#1935CA] dark:text-[#38BDF8] uppercase">
                  QUIZFORGE ACADEMY
                </span>
                <h4 className="text-2xl sm:text-3xl font-extrabold text-[#1E293B] dark:text-white font-serif">
                  Certificate of Excellence
                </h4>
                <div className="w-24 h-0.5 bg-amber-500 mx-auto" />
                <p className="text-xs text-[#696F79] dark:text-slate-400 font-medium">
                  This official academic credential certifies that
                </p>
                <p className="text-xl sm:text-2xl font-black text-[#1935CA] dark:text-[#38BDF8] tracking-tight">
                  {certMeta?.certificate?.recipientName || 'Candidate'}
                </p>
                <p className="text-xs text-[#696F79] dark:text-slate-400">
                  has demonstrated verified subject mastery in
                </p>
                <p className="text-base sm:text-lg font-bold text-[#1E293B] dark:text-white italic">
                  "{result.topic}"
                </p>

                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <span>Score: {result.score} / {result.totalQuestions} ({result.accuracyPercentage}%)</span>
                  <span>•</span>
                  <span>{result.accuracyPercentage >= 90 ? 'High Distinction' : 'Demonstrated Mastery'}</span>
                </div>

                {certMeta?.certificate?.verificationCode && (
                  <div className="pt-2 text-[11px] text-[#696F79] dark:text-slate-400 font-mono">
                    Verification Code: <strong className="text-[#1935CA] dark:text-[#38BDF8]">{certMeta.certificate.verificationCode}</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {certMeta?.certificate?.verificationCode ? (
                <Link
                  to={`/verify/${certMeta.certificate.verificationCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-bold text-[#1935CA] dark:text-[#38BDF8] hover:underline"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Public Registry Verification Link</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              ) : <div />}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCertificateModal(false)}
                  className="px-4 py-2 text-xs font-bold text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCertificate}
                  disabled={isDownloadingCert}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] shadow-md shadow-[#1935CA]/20 transition disabled:opacity-50"
                >
                  {isDownloadingCert ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>Download Official PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <GenerateQuizModal
        isOpen={isNewQuizModalOpen}
        onClose={() => setIsNewQuizModalOpen(false)}
      />
    </AppLayout>
  );
}
