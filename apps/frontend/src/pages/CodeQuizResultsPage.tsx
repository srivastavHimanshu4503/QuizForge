import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiClient, ApiError } from '../api/client';
import {
  Home,
  AlertCircle,
  Loader2,
  Sparkles,
  FileCode,
  ExternalLink,
  Award,
  RotateCcw,
  History,
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-white mb-1">Calculating Final Evaluation...</h2>
        <p className="text-sm text-slate-400">
          Aggregating LLM scores and comprehensive feedback
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-400 mb-4 inline-flex">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Results Error</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          {error || 'Unable to retrieve quiz results.'}
        </p>
        <Link
          to="/"
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const percentage = data.accuracyPercentage;
  let masteryLabel = 'Needs In-Depth Review';
  let badgeColor = 'bg-rose-500/20 text-rose-400 border-rose-500/30';

  if (percentage >= 85) {
    masteryLabel = 'Author-Level Mastery';
    badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  } else if (percentage >= 70) {
    masteryLabel = 'Senior Comprehension';
    badgeColor = 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
  } else if (percentage >= 50) {
    masteryLabel = 'Competent Understanding';
    badgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40">
        <Link
          to="/"
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <Home className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/history"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </Link>
          <a
            href={data.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <span>{data.repoOwner}/{data.repoName}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Score Card Hero */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-3">
                <Award className="w-3.5 h-3.5" />
                <span>Code Review Assessment Complete</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Review Evaluation
              </h1>
              <p className="mt-1.5 text-sm text-slate-400">
                Repository:{' '}
                <span className="font-mono text-slate-300 font-semibold">
                  {data.repoOwner}/{data.repoName}
                </span>{' '}
                ({data.branch} branch)
              </p>
            </div>

            {/* Score & Badge */}
            <div className="flex flex-col items-start sm:items-end gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-black text-white">
                  {data.totalScore.toFixed(1)}
                </span>
                <span className="text-lg text-slate-500 font-bold">
                  / {data.maxPossibleScore} pts
                </span>
              </div>
              <div className={`px-3 py-1 rounded-xl text-xs font-bold border ${badgeColor}`}>
                {masteryLabel} ({percentage.toFixed(1)}%)
              </div>
            </div>
          </div>

          {/* Quick stats strip */}
          <div className="mt-8 pt-6 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block">Total Questions</span>
              <span className="text-base font-bold text-white mt-0.5 block">
                {data.reviews.length}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Avg Score per Q</span>
              <span className="text-base font-bold text-amber-400 mt-0.5 block">
                {data.reviews.length > 0
                  ? (data.totalScore / data.reviews.length).toFixed(1)
                  : '0.0'}{' '}
                / 10
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-slate-500 block">Evaluation Standard</span>
              <span className="text-base font-bold text-slate-300 mt-0.5 block">
                OpenAI-Compatible LLM
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Question Reviews */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span>Question-by-Question Breakdown</span>
          </h2>

          {data.reviews.map((item, idx) => (
            <div
              key={item.questionId}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5"
            >
              {/* Question Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-mono font-bold text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <FileCode className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-mono font-semibold text-slate-300">
                    {item.codeSnippetPath}
                  </span>
                  {item.codeSnippetStartLine && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      Lines {item.codeSnippetStartLine}–
                      {item.codeSnippetEndLine || item.codeSnippetStartLine}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Score:</span>
                  <span
                    className={`text-sm font-extrabold px-3 py-0.5 rounded-lg border ${
                      item.score >= 8
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : item.score >= 5
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {item.score.toFixed(1)} / 10
                  </span>
                </div>
              </div>

              {/* Code Snippet */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 overflow-x-auto text-xs font-mono text-slate-300 shadow-inner">
                <pre className="leading-relaxed">
                  <code>{item.codeSnippetContent}</code>
                </pre>
              </div>

              {/* Question Text */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block mb-1">
                  Interview Question:
                </span>
                <p className="text-sm font-semibold text-white leading-snug">
                  {item.questionText}
                </p>
              </div>

              {/* User Submitted Answer */}
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Your Answer:
                </span>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {item.userAnswer || (
                    <span className="text-slate-500 italic">No answer submitted.</span>
                  )}
                </div>
              </div>

              {/* LLM Feedback & Score Bars */}
              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/40 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>LLM Evaluation Critique</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {item.feedback}
                </p>

                {/* Score Breakdown Bars */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Accuracy</span>
                      <span className="font-bold text-white">
                        {item.accuracyScore.toFixed(1)} / 4
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400"
                        style={{ width: `${(item.accuracyScore / 4) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Depth</span>
                      <span className="font-bold text-white">
                        {item.depthScore.toFixed(1)} / 3
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-400"
                        style={{ width: `${(item.depthScore / 3) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Completeness</span>
                      <span className="font-bold text-white">
                        {item.completenessScore.toFixed(1)} / 3
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400"
                        style={{ width: `${(item.completenessScore / 3) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Back to Dashboard
            </Link>
            <Link
              to="/history"
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5"
            >
              <History className="w-3.5 h-3.5" />
              <span>All Quizzes</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRetake}
              disabled={isRetaking}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
            >
              {isRetaking ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              <span>Retake Code Review</span>
            </button>
            <a
              href={data.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition"
            >
              <span>Explore Code on GitHub</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
