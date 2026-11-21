import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient, ApiError } from '../api/client';
import { ActiveCodeAttempt, AnswerEvaluation } from '@quiz-forge/shared';
import {
  Code2,
  Home,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Send,
  FileCode,
  Check,
  X,
  HelpCircle,
} from 'lucide-react';

export function CodeQuizPlayerPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const storageKey = `quizforge_code_attempt_${attemptId}`;

  const [attempt, setAttempt] = useState<ActiveCodeAttempt | null>(() => {
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // ignore
    }
    return null;
  });

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [evaluations, setEvaluations] = useState<Record<string, AnswerEvaluation | null>>({});
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(!attempt);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const attemptRef = useRef<ActiveCodeAttempt | null>(attempt);
  attemptRef.current = attempt;

  const fetchAttempt = useCallback(async () => {
    if (!attemptId) return;
    if (!attemptRef.current) setIsLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<ActiveCodeAttempt>(
        `/api/code-quizzes/attempts/${attemptId}`
      );
      setAttempt(data);
      attemptRef.current = data;

      // Populate existing answers and evaluations
      const initialAnswers: Record<string, string> = {};
      const initialEvals: Record<string, AnswerEvaluation | null> = {};

      data.questions.forEach((q) => {
        if (q.userAnswer) {
          initialAnswers[q.id] = q.userAnswer;
        }
        if (q.score !== null && q.score !== undefined && q.feedback) {
          initialEvals[q.id] = {
            score: q.score,
            accuracy_score: 0,
            depth_score: 0,
            completeness_score: 0,
            feedback: q.feedback,
            key_concepts_identified: [],
            key_concepts_missed: [],
          };
        }
      });

      setAnswers((prev) => ({ ...initialAnswers, ...prev }));
      setEvaluations((prev) => ({ ...initialEvals, ...prev }));

      // Cache for browser resilience
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch {
        // safe
      }
    } catch (err: unknown) {
      if (!attemptRef.current) {
        const msg = err instanceof ApiError ? err.message : 'Failed to load code quiz attempt.';
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [attemptId, storageKey]);

  useEffect(() => {
    fetchAttempt();
  }, [fetchAttempt]);

  const currentQuestion = attempt?.questions[currentIndex];

  const handleAnswerChange = (text: string) => {
    if (!currentQuestion) return;
    const updated = {
      ...answers,
      [currentQuestion.id]: text,
    };
    setAnswers(updated);

    // Save draft to localStorage
    try {
      localStorage.setItem(`quizforge_code_answers_${attemptId}`, JSON.stringify(updated));
    } catch {
      // safe
    }
  };

  const handleEvaluateCurrent = async () => {
    if (!currentQuestion || !attemptId) return;
    const text = answers[currentQuestion.id]?.trim();
    if (!text || text.length < 5) {
      setError('Please provide a meaningful answer (at least 5 characters) before evaluating.');
      return;
    }

    setError(null);
    setIsEvaluating(true);
    try {
      const result = await apiClient.post<{
        questionId: string;
        evaluation: AnswerEvaluation;
        evaluatedAt: string;
      }>(`/api/code-quizzes/attempts/${attemptId}/answers`, {
        questionId: currentQuestion.id,
        answer: text,
      });

      setEvaluations((prev) => ({
        ...prev,
        [currentQuestion.id]: result.evaluation,
      }));

      // Update question in state
      setAttempt((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          questions: prev.questions.map((q) =>
            q.id === currentQuestion.id
              ? {
                  ...q,
                  userAnswer: text,
                  score: result.evaluation.score,
                  feedback: result.evaluation.feedback,
                  evaluatedAt: result.evaluatedAt,
                }
              : q
          ),
        };
      });
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Evaluation failed. Please try again.';
      setError(msg);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!attemptId) return;
    setIsSubmitting(true);
    try {
      await apiClient.post(`/api/code-quizzes/attempts/${attemptId}/submit`);

      // Clean up localStorage on successful completion
      try {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`quizforge_code_answers_${attemptId}`);
        localStorage.removeItem('quizforge_last_active_code_attempt');
      } catch {
        // safe
      }

      navigate(`/code-quiz/${attemptId}/results`);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to finalize quiz attempt.';
      setError(msg);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-white mb-1">Loading Code Review...</h2>
        <p className="text-sm text-slate-400">
          Preparing source code snippets and evaluation context
        </p>
      </div>
    );
  }

  if (error && !attempt) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-400 mb-4 inline-flex">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Quiz Load Error</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6">{error}</p>
        <Link
          to="/"
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!attempt || !currentQuestion) {
    return null;
  }

  const currentAnswer = answers[currentQuestion.id] || '';
  const currentEvaluation = evaluations[currentQuestion.id] || null;

  const answeredCount = Object.values(answers).filter((a) => a.trim().length > 0).length;
  const evaluatedCount = Object.values(evaluations).filter(Boolean).length;
  const totalQuestions = attempt.questions.length;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40">
        <Link
          to="/"
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <Home className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-400 font-mono hidden sm:block">
            {attempt.repoOwner}/{attempt.repoName}
          </div>
          <button
            type="button"
            onClick={() => setIsSubmitModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Finish & View Results</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
            <span>
              Question {currentIndex + 1} of {totalQuestions}
            </span>
            <span>
              {answeredCount} Answered • {evaluatedCount} Evaluated
            </span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-3 text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
          {/* Main Question & Code Column (2 spans) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
              {/* File Path Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-mono font-semibold text-amber-300">
                    {currentQuestion.codeSnippetPath}
                  </span>
                  {currentQuestion.codeSnippetStartLine && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      Lines {currentQuestion.codeSnippetStartLine}–
                      {currentQuestion.codeSnippetEndLine || currentQuestion.codeSnippetStartLine}
                    </span>
                  )}
                </div>
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                  {currentQuestion.difficulty}
                </span>
              </div>

              {/* Formatted Code Block */}
              <div className="mb-6 bg-slate-950 border border-slate-800/80 rounded-2xl p-4 overflow-x-auto text-xs font-mono text-slate-300 shadow-inner">
                <pre className="leading-relaxed">
                  <code>{currentQuestion.codeSnippetContent}</code>
                </pre>
              </div>

              {/* Interview Question */}
              <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                  <HelpCircle className="w-4 h-4" />
                  <span>Interview Question</span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
                  {currentQuestion.questionText}
                </h2>
              </div>

              {/* User Answer Textarea */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="userAnswer"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
                  >
                    Your Answer & Explanation
                  </label>
                  <span className="text-xs text-slate-500">
                    {currentAnswer.length} characters
                  </span>
                </div>
                <textarea
                  id="userAnswer"
                  rows={5}
                  value={currentAnswer}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  placeholder="Explain what the code does, why specific lines or comments were written, edge cases considered, and trade-offs..."
                  className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition resize-y"
                />

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-xs text-slate-500">
                    Tip: Be specific. Address comments and edge cases directly.
                  </span>
                  <button
                    type="button"
                    onClick={handleEvaluateCurrent}
                    disabled={isEvaluating || currentAnswer.trim().length < 5}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {isEvaluating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Evaluating with LLM...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {currentEvaluation ? 'Re-Evaluate Answer' : 'Evaluate Answer'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Inline LLM Evaluation Feedback Card */}
              {currentEvaluation && (
                <div className="mt-6 p-5 rounded-2xl bg-slate-950 border border-slate-800 animate-in fade-in duration-300">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        LLM Evaluation Result
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Score:</span>
                      <span
                        className={`text-base font-extrabold px-3 py-0.5 rounded-lg ${
                          currentEvaluation.score >= 8
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : currentEvaluation.score >= 5
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {currentEvaluation.score.toFixed(1)} / 10
                      </span>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
                    {currentEvaluation.feedback}
                  </p>

                  {/* Identified vs Missed Concepts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {currentEvaluation.key_concepts_identified.length > 0 && (
                      <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40">
                        <span className="font-semibold text-emerald-400 block mb-1">
                          Key Concepts Captured:
                        </span>
                        <ul className="space-y-1 text-slate-300">
                          {currentEvaluation.key_concepts_identified.map((c, i) => (
                            <li key={i} className="flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {currentEvaluation.key_concepts_missed.length > 0 && (
                      <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-800/40">
                        <span className="font-semibold text-rose-400 block mb-1">
                          Missing or Under-Explored:
                        </span>
                        <ul className="space-y-1 text-slate-300">
                          {currentEvaluation.key_concepts_missed.map((c, i) => (
                            <li key={i} className="flex items-center gap-1.5">
                              <X className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Nav Controls */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Previous Question</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentIndex((idx) => Math.min(totalQuestions - 1, idx + 1))}
                disabled={currentIndex === totalQuestions - 1}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <span>Next Question</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Sidebar Palette & Repo Info */}
          <div className="space-y-6">
            {/* Question Palette */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-4">Questions Matrix</h3>
              <div className="grid grid-cols-5 gap-2.5">
                {attempt.questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const hasAnswer = Boolean(answers[q.id]?.trim());
                  const hasEval = Boolean(evaluations[q.id]);

                  let badgeClass = 'bg-slate-800 border-slate-700 text-slate-400';
                  if (hasEval) {
                    badgeClass = 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
                  } else if (hasAnswer) {
                    badgeClass = 'bg-amber-500/20 border-amber-500/40 text-amber-400';
                  }

                  if (isCurrent) {
                    badgeClass += ' ring-2 ring-amber-400 font-extrabold scale-105';
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-10 rounded-xl border text-xs font-bold transition-all flex items-center justify-center ${badgeClass}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 space-y-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500/30 border border-emerald-500" />
                  <span>Evaluated with Score</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500/30 border border-amber-500" />
                  <span>Draft Answer Typed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-800 border border-slate-700" />
                  <span>Unanswered</span>
                </div>
              </div>
            </div>

            {/* Repository Info Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl text-xs space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Code2 className="w-4 h-4 text-amber-400" />
                <span>Target Repository</span>
              </div>
              <div className="text-slate-300 font-mono break-all">
                {attempt.repoOwner}/{attempt.repoName}
              </div>
              <a
                href={attempt.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 hover:text-amber-300 block font-semibold transition"
              >
                View on GitHub →
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Submit Confirmation Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Finalize Code Review?</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              You have answered {answeredCount} of {totalQuestions} questions ({evaluatedCount} evaluated).
              Finalizing will compute your overall mastery score and complete this session.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Continue Answering
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit & View Results</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
