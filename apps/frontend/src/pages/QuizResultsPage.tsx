import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AttemptResult } from '@quiz-forge/shared';
import { apiClient, ApiError } from '../api/client';
import { ScoreCard } from '../components/quiz/ScoreCard';
import { ReviewQuestionItem } from '../components/quiz/ReviewQuestionItem';
import { GenerateQuizModal } from '../components/quiz/GenerateQuizModal';
import {
  RotateCcw,
  Sparkles,
  History,
  Home,
  Loader2,
  AlertCircle,
  Filter,
} from 'lucide-react';

export function QuizResultsPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [result, setResult] = useState<AttemptResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isNewQuizModalOpen, setIsNewQuizModalOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'incorrect' | 'correct'>('all');

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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-white mb-1">Evaluating Results...</h2>
        <p className="text-sm text-slate-400">
          Calculating score and compiling your answer review
        </p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-400 mb-4 inline-flex">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Results Unavailable</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          {error || 'Unable to retrieve attempt results.'}
        </p>
        <Link
          to="/"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-600/20"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  // Filter review items
  const filteredReview = result.review.filter((item) => {
    if (filterMode === 'correct') return item.is_correct;
    if (filterMode === 'incorrect') return !item.is_correct;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <span className="text-slate-700">|</span>
          <Link
            to="/history"
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">History</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRestart}
            disabled={isRestarting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
          >
            {isRestarting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            <span>Restart (Retake)</span>
          </button>
          <button
            type="button"
            onClick={() => setIsNewQuizModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>New Quiz</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Score Card */}
        <ScoreCard result={result} />

        {/* Action Callout Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">
              Ready for your next challenge?
            </h3>
            <p className="text-xs text-slate-400">
              Retake this quiz with questions in a shuffled order (zero AI calls), or generate a new quiz.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRestart}
              disabled={isRestarting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
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
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Generate Another Quiz</span>
            </button>
          </div>
        </div>

        {/* Review Section */}
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Answer-by-Answer Review
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect your selections alongside correct answers and explanations
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500 ml-2 mr-1" />
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  filterMode === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({result.review.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('incorrect')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  filterMode === 'incorrect'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Missed ({result.incorrectCount + result.unansweredCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('correct')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  filterMode === 'correct'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Correct ({result.correctCount})
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {filteredReview.map((item, idx) => (
              <ReviewQuestionItem
                key={item.question_id}
                questionNumber={idx + 1}
                review={item}
              />
            ))}

            {filteredReview.length === 0 && (
              <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 text-center text-slate-400 text-sm">
                No questions matching the selected filter.
              </div>
            )}
          </div>
        </section>
      </main>

      <GenerateQuizModal
        isOpen={isNewQuizModalOpen}
        onClose={() => setIsNewQuizModalOpen(false)}
      />
    </div>
  );
}
