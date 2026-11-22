import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { HistoryItem, HistoryResponse } from '@quiz-forge/shared';
import { apiClient, ApiError } from '../api/client';
import { AppLayout } from '../components/layout/AppLayout';
import { GenerateQuizModal } from '../components/quiz/GenerateQuizModal';
import { CodeQuizModal } from '../components/code-quiz/CodeQuizModal';
import {
  History,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Code2,
  Brain,
  Layers,
  Clock,
} from 'lucide-react';

export function HistoryPage() {
  const [searchParams] = useSearchParams();
  const searchFilter = searchParams.get('q') || '';

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

  // Filter items by query if search parameter is present
  const displayedItems = history?.items.filter((item) => {
    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    const titleMatch = (item.topic || item.repoName || '').toLowerCase().includes(query);
    const repoMatch = (item.repoUrl || '').toLowerCase().includes(query);
    return titleMatch || repoMatch;
  }) || [];

  return (
    <AppLayout activeNav="history">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-[#151C2C] rounded-[20px] p-6 shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100/80 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors duration-200">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EEF2FF] dark:bg-slate-800 text-[#1935CA] dark:text-[#38BDF8] text-xs font-bold mb-2">
              <History className="w-3.5 h-3.5" />
              <span>Unified Performance Archive</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1935CA] dark:text-[#38BDF8] tracking-tight">
              Quiz History & Retakes
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#696F79] dark:text-slate-400">
              Review past MCQ quizzes and GitHub code reviews. Retake question sets anytime with zero AI calls.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCodeQuizModalOpen(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#EEF2FF] dark:bg-slate-800 hover:bg-[#1935CA]/10 dark:hover:bg-slate-700 text-[#1935CA] dark:text-[#38BDF8] transition flex items-center gap-1.5"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Review GitHub Repo</span>
            </button>
            <button
              type="button"
              onClick={() => setIsGenerateModalOpen(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#1935CA] hover:bg-[#142BA3] text-white shadow-[0_8px_20px_rgba(25,53,202,0.22)] transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate MCQ</span>
            </button>
          </div>
        </div>

        {/* Elevated History Card Container */}
        <div className="bg-white dark:bg-[#151C2C] rounded-[20px] p-6 shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100/80 dark:border-slate-800 space-y-6 transition-colors duration-200">
          {/* 3 Filter Tabs (Synced with ?type=all|code|mcq) */}
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4 flex-wrap">
            <button
              type="button"
              onClick={() => handleFilterChange('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                filterType === 'all'
                  ? 'bg-[#1935CA] text-white shadow-[0_8px_20px_rgba(25,53,202,0.22)]'
                  : 'bg-[#F8F9FC] dark:bg-slate-800 text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white'
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
                  ? 'bg-[#1935CA] text-white shadow-[0_8px_20px_rgba(25,53,202,0.22)]'
                  : 'bg-[#F8F9FC] dark:bg-slate-800 text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white'
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
                  ? 'bg-[#1935CA] text-white shadow-[0_8px_20px_rgba(25,53,202,0.22)]'
                  : 'bg-[#F8F9FC] dark:bg-slate-800 text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>MCQ Quizzes</span>
            </button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="py-16 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#1935CA] dark:text-[#38BDF8] animate-spin mb-3" />
              <p className="text-xs text-[#696F79] dark:text-slate-400">Loading your history records...</p>
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="p-4 rounded-xl bg-[#FEF2F2] dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-center text-rose-700 dark:text-rose-400 text-xs font-medium">
              <p>{error}</p>
              <button
                onClick={() => fetchHistory(page, filterType)}
                className="mt-2.5 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && history && displayedItems.length === 0 && (
            <div className="py-12 text-center max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] dark:bg-slate-800 text-[#1935CA] dark:text-[#38BDF8] flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#1E293B] dark:text-[#F8FAFC] mb-1">No Completed Quizzes Found</h3>
              <p className="text-xs text-[#696F79] dark:text-slate-400 mb-5">
                {filterType === 'code'
                  ? "You haven't completed any GitHub code reviews yet. Analyze any public repo to get started!"
                  : filterType === 'mcq'
                  ? "You haven't completed any MCQ quizzes yet. Generate your first topic assessment!"
                  : "No completed attempts match your current view. Create an assessment to begin!"}
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsCodeQuizModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#EEF2FF] dark:bg-slate-800 text-[#1935CA] dark:text-[#38BDF8] hover:bg-[#1935CA]/10 transition"
                >
                  Review Repo
                </button>
                <button
                  type="button"
                  onClick={() => setIsGenerateModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1935CA] text-white hover:bg-[#142BA3] transition shadow-md"
                >
                  Generate Quiz
                </button>
              </div>
            </div>
          )}

          {/* History Scannable Rows */}
          {!isLoading && history && displayedItems.length > 0 && (
            <div className="space-y-3">
              {displayedItems.map((item: HistoryItem) => {
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

                const title = isCodeReview
                  ? item.repoName || item.topic || 'Code Review'
                  : item.topic || 'MCQ Quiz';

                const scorePercent = item.accuracyPercentage;

                return (
                  <div
                    key={item.attemptId}
                    className="p-4 sm:p-5 rounded-xl bg-[#F8F9FC] dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 hover:border-slate-200 dark:hover:border-slate-600 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    {/* Left: Mode Badge & Title */}
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                          isCodeReview
                            ? 'bg-[#1935CA] text-white'
                            : 'bg-[#EEF2FF] dark:bg-slate-700 text-[#1935CA] dark:text-[#38BDF8]'
                        }`}
                      >
                        {isCodeReview ? <Code2 className="w-5 h-5" /> : <Brain className="w-5 h-5" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isCodeReview
                                ? 'bg-blue-100 dark:bg-blue-950/60 text-[#1935CA] dark:text-[#38BDF8]'
                                : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                            }`}
                          >
                            {isCodeReview ? 'GitHub Review' : 'MCQ Quiz'}
                          </span>
                          <span className="text-xs text-[#94A3B8]">•</span>
                          <span className="text-xs text-[#696F79] dark:text-slate-400 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#94A3B8]" />
                            <span>{dateFormatted}</span>
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-[#1E293B] dark:text-[#F8FAFC] mt-1 break-all">
                          {title}
                        </h4>
                      </div>
                    </div>

                    {/* Middle: Score Bar */}
                    <div className="w-full md:w-48 shrink-0">
                      <div className="flex justify-between items-center text-xs font-semibold mb-1">
                        <span className="text-[#696F79] dark:text-slate-400">Score</span>
                        <span className="font-extrabold text-[#1E293B] dark:text-[#F8FAFC]">{scorePercent}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full ${
                            scorePercent >= 80
                              ? 'bg-emerald-500'
                              : scorePercent >= 50
                              ? 'bg-[#1935CA]'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, scorePercent))}%` }}
                        />
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                      <Link
                        to={
                          isCodeReview
                            ? `/code-quiz/${item.attemptId}/results`
                            : `/quiz/${item.attemptId}/results`
                        }
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#1935CA] dark:text-[#38BDF8] bg-white dark:bg-[#151C2C] hover:bg-[#EEF2FF] dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition flex items-center gap-1"
                      >
                        <span>Review</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleRetake(item)}
                        disabled={restartingQuizId === item.quizId}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] shadow-sm transition flex items-center gap-1 disabled:opacity-50"
                      >
                        {restartingQuizId === item.quizId ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        <span>Retake</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-[#696F79] dark:text-slate-400">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg bg-[#F8F9FC] dark:bg-slate-800 text-[#1E293B] dark:text-[#F8FAFC] hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-[#F8F9FC] dark:bg-slate-800 text-[#1E293B] dark:text-[#F8FAFC] hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CodeQuizModal isOpen={isCodeQuizModalOpen} onClose={() => setIsCodeQuizModalOpen(false)} />
      <GenerateQuizModal isOpen={isGenerateModalOpen} onClose={() => setIsGenerateModalOpen(false)} />
    </AppLayout>
  );
}
