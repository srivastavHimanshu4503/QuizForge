import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiClient, ApiError } from '../api/client';
import { AppLayout } from '../components/layout/AppLayout';
import {
  Home,
  AlertCircle,
  Loader2,
  Sparkles,
  FileCode,
  ExternalLink,
  Award,
  RotateCcw,
  ChevronRight,
} from 'lucide-react';

interface QuestionReviewItem {
  questionId: string;
  questionOrder: number;
  questionText: string;
  codeSnippetPath: string;
  codeSnippetContent: string;
  codeSnippetStartLine: number | null;
  codeSnippetEndLine: number | null;
  difficulty: 'easy' | 'medium' | 'hard';
  expectedConcepts: string[];
  userAnswer: string | null;
  score: number;
  accuracyScore: number;
  depthScore: number;
  completenessScore: number;
  feedback: string;
  evaluatedAt: string | null;
}

interface CodeResultsData {
  attemptId: string;
  codeQuizId: string;
  repoUrl: string;
  repoOwner: string;
  repoName: string;
  branch: string;
  status: string;
  totalScore: number;
  maxPossibleScore: number;
  accuracyPercentage: number;
  startedAt: string;
  completedAt: string | null;
  reviews: QuestionReviewItem[];
}

export function CodeQuizResultsPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<CodeResultsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetaking, setIsRetaking] = useState<boolean>(false);

  const handleRetake = async () => {
    if (!data) return;
    setIsRetaking(true);
    try {
      const res = await apiClient.post<{
        codeQuizId: string;
        attemptId: string;
        totalQuestions: number;
        status: string;
      }>(`/api/code-quizzes/${data.codeQuizId}/restart`);
      navigate(`/code-quiz/${res.attemptId}`);
    } catch (err: unknown) {
      alert(err instanceof ApiError ? err.message : 'Failed to restart code review.');
      setIsRetaking(false);
    }
  };

  useEffect(() => {
    if (!attemptId) return;
    setIsLoading(true);
    apiClient
      .get<CodeResultsData>(`/api/code-quizzes/attempts/${attemptId}/results`)
      .then((res) => {
        setData(res);
      })
      .catch((err: unknown) => {
        const msg = err instanceof ApiError ? err.message : 'Failed to load results.';
        setError(msg);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [attemptId]);

  if (isLoading) {
    return (
      <AppLayout activeNav="code-review">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 text-[#1935CA] animate-spin mb-4" />
          <h2 className="text-xl font-bold text-[#1935CA] mb-1">Calculating Final Evaluation...</h2>
          <p className="text-sm text-[#696F79]">
            Aggregating LLM scores and grading rubrics
          </p>
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout activeNav="code-review">
        <div className="max-w-md mx-auto text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold text-[#1E293B] mb-2">Results Error</h2>
          <p className="text-xs text-[#696F79] mb-6">{error || 'Unable to retrieve quiz results.'}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1935CA] text-white text-xs font-bold shadow-md"
          >
            <Home className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const percentage = data.accuracyPercentage;
  let masteryLabel = 'Needs In-Depth Review';
  let badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';

  if (percentage >= 85) {
    masteryLabel = 'Author-Level Mastery';
    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (percentage >= 70) {
    masteryLabel = 'Senior Comprehension';
    badgeColor = 'bg-[#EEF2FF] text-[#1935CA] border-[#1935CA]/30';
  } else if (percentage >= 50) {
    masteryLabel = 'Competent Understanding';
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
  }

  // Calculate average rubrics
  const totalReviews = data.reviews.length || 1;
  const avgAccuracy = (data.reviews.reduce((acc, r) => acc + (r.accuracyScore || (r.score >= 7 ? 4 : 2)), 0) / totalReviews).toFixed(1);
  const avgDepth = (data.reviews.reduce((acc, r) => acc + (r.depthScore || (r.score >= 7 ? 3 : 1)), 0) / totalReviews).toFixed(1);
  const avgCompleteness = (data.reviews.reduce((acc, r) => acc + (r.completenessScore || (r.score >= 7 ? 3 : 1)), 0) / totalReviews).toFixed(1);

  return (
    <AppLayout activeNav="code-review">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header Bar */}
        <div className="bg-white dark:bg-[#151C2C] rounded-[20px] p-4 sm:p-5 shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100/80 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors duration-200">
          <div className="flex items-center gap-2 text-xs font-medium text-[#696F79] dark:text-slate-400">
            <Link to="/" className="hover:text-[#1935CA] dark:hover:text-[#38BDF8] transition font-semibold">
              Dashboard
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
            <Link to="/history" className="hover:text-[#1935CA] dark:hover:text-[#38BDF8] transition font-semibold">
              History
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
            <span className="font-bold text-[#1935CA] dark:text-[#38BDF8]">Evaluation Results</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              to="/history"
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC] bg-[#F8F9FC] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              All Quizzes
            </Link>
            <button
              type="button"
              onClick={handleRetake}
              disabled={isRetaking}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1935CA] hover:bg-[#142BA3] text-white shadow-[0_8px_20px_rgba(25,53,202,0.22)] transition flex items-center gap-1.5 disabled:opacity-50 active:scale-98"
            >
              {isRetaking ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Restarting...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retake Code Review</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Hero Score Card */}
        <div className="bg-white dark:bg-[#151C2C] rounded-[20px] p-6 sm:p-8 shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100/80 dark:border-slate-800 relative overflow-hidden transition-colors duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EEF2FF] dark:bg-slate-800 text-[#1935CA] dark:text-[#38BDF8] text-xs font-bold mb-3">
                <Award className="w-3.5 h-3.5" />
                <span>Code Review Assessment Complete</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1935CA] dark:text-[#38BDF8] tracking-tight">
                Review Evaluation Summary
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-[#696F79] dark:text-slate-400">
                Repository:{' '}
                <a
                  href={data.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[#1E293B] dark:text-[#F8FAFC] font-bold hover:text-[#1935CA] dark:hover:text-[#38BDF8] inline-flex items-center gap-1"
                >
                  <span>{data.repoOwner}/{data.repoName}</span>
                  <ExternalLink className="w-3 h-3 text-[#94A3B8]" />
                </a>{' '}
                ({data.branch} branch)
              </p>
            </div>

            {/* Score & Badge */}
            <div className="flex flex-col items-start sm:items-end gap-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl sm:text-5xl font-black text-[#1E293B] dark:text-[#F8FAFC]">
                  {data.totalScore.toFixed(1)}
                </span>
                <span className="text-base text-[#94A3B8] dark:text-slate-400 font-bold">
                  / {data.maxPossibleScore} pts
                </span>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold border ${badgeColor}`}>
                {masteryLabel} ({percentage.toFixed(1)}%)
              </div>
            </div>
          </div>

          {/* Aggregate Rubric Bars Strip */}
          <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="p-4 rounded-xl bg-[#F8F9FC] dark:bg-slate-800/60 border border-slate-100/80 dark:border-slate-700/60">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC]">Accuracy</span>
                <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">{avgAccuracy} / 4.0</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{ width: `${(Number(avgAccuracy) / 4) * 100}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#F8F9FC] dark:bg-slate-800/60 border border-slate-100/80 dark:border-slate-700/60">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC]">Depth</span>
                <span className="text-xs font-extrabold text-[#1935CA] dark:text-[#38BDF8]">{avgDepth} / 3.0</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#1935CA] h-2 rounded-full"
                  style={{ width: `${(Number(avgDepth) / 3) * 100}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#F8F9FC] dark:bg-slate-800/60 border border-slate-100/80 dark:border-slate-700/60">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC]">Completeness</span>
                <span className="text-xs font-extrabold text-[#38BDF8]">{avgCompleteness} / 3.0</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#38BDF8] h-2 rounded-full"
                  style={{ width: `${(Number(avgCompleteness) / 3) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Question Reviews */}
        <div className="space-y-5">
          <h2 className="text-lg font-extrabold text-[#1935CA] dark:text-[#38BDF8] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8]" />
            <span>Question-by-Question Breakdown</span>
          </h2>

          {data.reviews.map((item, idx) => (
            <div
              key={item.questionId}
              className="bg-white dark:bg-[#151C2C] rounded-[20px] p-6 sm:p-7 shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100/80 dark:border-slate-800 space-y-4 transition-colors duration-200"
            >
              {/* Question Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-[#EEF2FF] dark:bg-slate-800 text-[#1935CA] dark:text-[#38BDF8] font-extrabold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-[#1E293B] dark:text-[#F8FAFC]">
                      {item.questionText}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-[#696F79] dark:text-slate-400">
                      <FileCode className="w-3.5 h-3.5 text-[#1935CA] dark:text-[#38BDF8]" />
                      <span>{item.codeSnippetPath}</span>
                    </div>
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-extrabold shrink-0 ${
                    item.score >= 7
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : item.score >= 4
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {item.score} / 10 pts
                </span>
              </div>

              {/* User's Answer */}
              <div className="p-4 rounded-xl bg-[#F8F9FC] dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="block text-[11px] font-bold text-[#696F79] dark:text-slate-400 uppercase tracking-wider mb-1">
                  Your Answer / Defense:
                </span>
                <p className="text-xs text-[#1E293B] dark:text-[#F8FAFC] font-medium leading-relaxed whitespace-pre-wrap">
                  {item.userAnswer || 'No answer submitted.'}
                </p>
              </div>

              {/* LLM Feedback & Identified/Missed Concepts */}
              <div className="p-4 rounded-xl bg-[#EEF2FF]/60 dark:bg-indigo-950/40 border border-[#1935CA]/10 dark:border-indigo-800/40 space-y-3">
                <div>
                  <span className="block text-[11px] font-bold text-[#1935CA] dark:text-[#38BDF8] uppercase tracking-wider mb-1">
                    AI Rubric Feedback:
                  </span>
                  <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed font-medium">
                    {item.feedback}
                  </p>
                </div>

                {/* Expected Concepts */}
                {item.expectedConcepts && item.expectedConcepts.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="block text-[10px] font-bold text-[#696F79] dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Key Concepts Evaluated:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {item.expectedConcepts.map((concept, cIdx) => (
                        <span
                          key={cIdx}
                          className="px-2.5 py-0.5 rounded-full bg-white dark:bg-[#151C2C] text-[#1935CA] dark:text-[#38BDF8] border border-slate-200 dark:border-slate-700 text-[11px] font-semibold"
                        >
                          {concept}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
