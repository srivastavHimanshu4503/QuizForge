import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AttemptResult } from '@quiz-forge/shared';
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
} from 'lucide-react';

export function QuizResultsPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [result, setResult] = useState<AttemptResult | null>(null);
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

      <GenerateQuizModal
        isOpen={isNewQuizModalOpen}
        onClose={() => setIsNewQuizModalOpen(false)}
      />
    </AppLayout>
  );
}
