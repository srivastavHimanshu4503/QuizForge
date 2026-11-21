import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { HistoryItem, HistoryResponse } from '@quiz-forge/shared';
import { apiClient, ApiError } from '../api/client';
import { Navbar } from '../components/layout/Navbar';
import { GenerateQuizModal } from '../components/quiz/GenerateQuizModal';
import { CodeQuizModal } from '../components/code-quiz/CodeQuizModal';
import {
  History,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Loader2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Code2,
  Brain,
  ExternalLink,
  Layers,
  SlidersHorizontal,
} from 'lucide-react';

export function HistoryPage() {
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [page, setPage] = useState<number>(1);
  const [filterType, setFilterType] = useState<'all' | 'mcq' | 'code'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [restartingQuizId, setRestartingQuizId] = useState<string | null>(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState<boolean>(false);
  const [isCodeQuizModalOpen, setIsCodeQuizModalOpen] = useState<boolean>(false);

  const navigate = useNavigate();
  const limit = 10;

  const fetchHistory = async (pageNum: number, type: 'all' | 'mcq' | 'code') => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<HistoryResponse>(
        `/api/history?page=${pageNum}&limit=${limit}&type=${type}`
      );
      setHistory(data);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError ? err.message : 'Failed to retrieve quiz history.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(page, filterType);
  }, [page, filterType]);

  const handleFilterChange = (type: 'all' | 'mcq' | 'code') => {
    setFilterType(type);
    setPage(1);
  };

  const handleRetake = async (item: HistoryItem) => {
    setRestartingQuizId(item.quizId);
    try {
      if (item.type === 'code_review') {
        const data = await apiClient.post<{
          codeQuizId: string;
          attemptId: string;
          totalQuestions: number;
          status: string;
        }>(`/api/code-quizzes/${item.quizId}/restart`);

        navigate(`/code-quiz/${data.attemptId}`);
      } else {
        const data = await apiClient.post<{
          quizId: string;
          attemptId: string;
          attemptNumber: number;
          totalQuestions: number;
          status: string;
        }>(`/api/quizzes/${item.quizId}/restart`);

        navigate(`/quiz/${data.attemptId}`);
      }
    } catch (err: unknown) {
      alert(
        err instanceof ApiError
          ? err.message
          : 'Failed to restart quiz. Please try again.'
      );
      setRestartingQuizId(null);
    }
  };

  const totalPages = history ? Math.ceil(history.total / history.pageSize) : 1;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-1">
              <History className="w-3.5 h-3.5" />
              <span>Performance Archive</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
              Quiz History & Retakes
            </h1>
            <p className="mt-1 text-slate-400 text-sm">
              Review your past MCQ quiz and GitHub code review performances, examine evaluations, and retake question sets with zero AI calls.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCodeQuizModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 transition"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Review GitHub Repo</span>
            </button>
            <button
              type="button"
              onClick={() => setIsGenerateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate MCQ Quiz</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-4">
          <button
            type="button"
            onClick={() => handleFilterChange('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              filterType === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Quizzes</span>
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('code')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              filterType === 'code'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>GitHub Code Reviews</span>
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('mcq')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              filterType === 'mcq'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>MCQ Quizzes</span>
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-16 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
            <p className="text-xs text-slate-400">Loading your history records...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800 text-center text-rose-300 text-sm mb-6">
            <p>{error}</p>
            <button
              onClick={() => fetchHistory(page, filterType)}
              className="mt-3 px-3.5 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-900 text-xs font-semibold text-rose-200 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && history && history.items.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center max-w-lg mx-auto shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Quizzes Completed Yet</h3>
            <p className="text-sm text-slate-400 mb-6">
              {filterType === 'code'
                ? "You haven't completed any GitHub repository code reviews yet. Input any public GitHub repo to get started!"
                : filterType === 'mcq'
                ? "You haven't completed any topic MCQ quizzes yet. Generate your first quiz on any topic you want to learn!"
                : "You haven't completed any quizzes yet. Create your first MCQ quiz or review a GitHub repo!"}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsCodeQuizModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Review GitHub Repo</span>
              </button>
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create Topic Quiz</span>
              </button>
            </div>
          </div>
        )}

        {/* History Grid */}
        {!isLoading && history && history.items.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {history.items.map((item: HistoryItem) => {
                const isCodeReview = item.type === 'code_review';
                const dateFormatted = new Date(item.completedAt).toLocaleDateString(
                  undefined,
                  {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }
                );

                const isRestartingThis = restartingQuizId === item.quizId;

                return (
                  <div
                    key={item.attemptId}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {isCodeReview ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                            <Code2 className="w-3 h-3" />
                            <span>Code Review</span>
                          </span>
                        ) : (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                            <Brain className="w-3 h-3" />
                            <span>MCQ Quiz</span>
                          </span>
                        )}

                        <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                          {item.difficulty}
                        </span>

                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 border border-slate-700/80">
                          Attempt #{item.attemptNumber}
                        </span>

                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {dateFormatted}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-white tracking-tight">
                          {item.topic}
                        </h2>
                        {isCodeReview && item.repoUrl && (
                          <a
                            href={item.repoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 hover:text-white transition"
                            title="View repository on GitHub"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span>{item.totalQuestions} Questions</span>
                        <span>&bull;</span>
                        <span>
                          Score:{' '}
                          <strong className="text-white font-semibold">
                            {isCodeReview
                              ? `${typeof item.score === 'number' ? item.score.toFixed(1) : item.score} / ${item.maxScore ?? (item.totalQuestions * 10)} pts`
                              : `${item.score} / ${item.totalQuestions}`}
                          </strong>
                        </span>
                        <span>&bull;</span>
                        <span className="text-cyan-400 font-semibold">
                          {item.accuracyPercentage}% Accuracy
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2.5 pt-2 sm:pt-0 shrink-0">
                      {!isCodeReview && (
                        <Link
                          to={`/studio/${item.quizId}`}
                          className="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition flex items-center gap-1.5"
                          title="Open Quiz Studio to review, edit questions, publish, or copy share link"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span>Studio</span>
                        </Link>
                      )}

                      <Link
                        to={
                          isCodeReview
                            ? `/code-quiz/${item.attemptId}/results`
                            : `/quiz/${item.attemptId}/results`
                        }
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
                      >
                        <span>Review</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleRetake(item)}
                        disabled={isRestartingThis}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold shadow-md transition flex items-center gap-1.5 disabled:opacity-50 ${
                          isCodeReview
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                        }`}
                        title={
                          isCodeReview
                            ? 'Retake this code review quiz with a clean attempt (Zero AI generation calls)'
                            : 'Retake this question set in a shuffled order (Zero AI calls)'
                        }
                      >
                        {isRestartingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        <span>Retake</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-6 border-t border-slate-800 text-xs text-slate-400">
                <span>
                  Showing page <strong className="text-white">{page}</strong> of{' '}
                  <strong className="text-white">{totalPages}</strong> ({history.total} total attempts)
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <GenerateQuizModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
      />

      <CodeQuizModal
        isOpen={isCodeQuizModalOpen}
        onClose={() => setIsCodeQuizModalOpen(false)}
      />
    </div>
  );
}
