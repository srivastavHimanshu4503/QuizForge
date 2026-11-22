import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
        {/* Score Card */}
        <ScoreCard result={result} />

        {/* Action Callout Bar */}
        <div className="bg-white border border-slate-100 rounded-[20px] p-6 sm:p-7 shadow-[0_10px_30px_rgba(25,53,202,0.05)] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-[#1E293B] mb-1">
              Ready for your next challenge?
            </h3>
            <p className="text-xs text-[#696F79] font-medium">
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
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-[#1E293B] border border-slate-200/80 shadow-sm transition"
            >
              <Sparkles className="w-4 h-4 text-[#1935CA]" />
              <span>Generate Another Quiz</span>
            </button>
          </div>
        </div>

        {/* Review Section */}
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-2xl font-bold text-[#1E293B] tracking-tight">
                Answer-by-Answer Review
              </h2>
              <p className="text-xs text-[#696F79] mt-0.5 font-medium">
                Inspect your selections alongside correct answers and explanations
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white border border-slate-200/80 text-xs shadow-sm">
              <Filter className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  filterMode === 'all'
                    ? 'bg-[#1935CA] text-white shadow-sm'
                    : 'text-[#696F79] hover:text-[#1E293B]'
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
                    : 'text-[#696F79] hover:text-[#1E293B]'
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
                    : 'text-[#696F79] hover:text-[#1E293B]'
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
              <div className="p-8 rounded-[20px] bg-white border border-slate-100 shadow-[0_10px_30px_rgba(25,53,202,0.05)] text-center text-[#696F79] text-sm">
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
