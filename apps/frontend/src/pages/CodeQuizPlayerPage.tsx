import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient, ApiError } from '../api/client';
import { ActiveCodeAttempt, AnswerEvaluation } from '@quiz-forge/shared';
import { AppLayout } from '../components/layout/AppLayout';
import {
  Home,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Send,
  FileCode,
  ChevronRight,
  Award,
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

  // CRITICAL RATE-LIMIT REGRESSION GUARD:
  // attemptRef holds current attempt without causing useCallback to re-trigger
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

      let cachedEvals: Record<string, AnswerEvaluation> = {};
      try {
        const rawEvals = localStorage.getItem(`quizforge_code_evals_${attemptId}`);
        if (rawEvals) cachedEvals = JSON.parse(rawEvals);
      } catch {
        // safe
      }

      data.questions.forEach((q) => {
        if (q.userAnswer) {
          initialAnswers[q.id] = q.userAnswer;
        }
        const cached = cachedEvals[q.id];
        if (cached) {
          initialEvals[q.id] = cached;
        } else if (q.score !== null && q.score !== undefined && q.feedback) {
          const s = q.score;
          const computedAcc = Math.min(4, Math.max(0, Math.round((s / 10) * 4 * 10) / 10));
          const computedDepth = Math.min(3, Math.max(0, Math.round((s / 10) * 3 * 10) / 10));
          const computedComp = Math.min(3, Math.max(0, Math.round((s - computedAcc - computedDepth) * 10) / 10));
          initialEvals[q.id] = {
            score: s,
            accuracy_score: computedAcc,
            depth_score: computedDepth,
            completeness_score: computedComp,
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
    const answerText = answers[currentQuestion.id] || '';

    if (!answerText.trim()) {
      alert('Please write an answer before requesting an LLM evaluation.');
      return;
    }

    setIsEvaluating(true);
    try {
      const res = await apiClient.post<any>(
        `/api/code-quizzes/attempts/${attemptId}/answers`,
        {
          questionId: currentQuestion.id,
          answer: answerText.trim(),
        }
      );

      // Backend returns { success: true, data: { questionId, evaluation, evaluatedAt } }
      const evalData: AnswerEvaluation = (res?.evaluation || res) as AnswerEvaluation;

      setEvaluations((prev) => ({
        ...prev,
        [currentQuestion.id]: evalData,
      }));

      // Cache evaluations in localStorage for persistence across reloads
      try {
        const stored = JSON.parse(localStorage.getItem(`quizforge_code_evals_${attemptId}`) || '{}');
        stored[currentQuestion.id] = evalData;
        localStorage.setItem(`quizforge_code_evals_${attemptId}`, JSON.stringify(stored));
      } catch {
        // safe
      }

      // Update question in local state
      if (attempt) {
        const updatedQuestions = attempt.questions.map((q) =>
          q.id === currentQuestion.id
            ? { ...q, score: evalData.score, feedback: evalData.feedback, userAnswer: answerText }
            : q
        );
        const updatedAttempt = { ...attempt, questions: updatedQuestions };
        setAttempt(updatedAttempt);
        try {
          localStorage.setItem(storageKey, JSON.stringify(updatedAttempt));
        } catch {
          // safe
        }
      }
    } catch (err: unknown) {
      alert(err instanceof ApiError ? err.message : 'Failed to evaluate answer with LLM.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSubmitAttempt = async () => {
    if (!attemptId) return;
    setIsSubmitting(true);
    try {
      await apiClient.post(`/api/code-quizzes/attempts/${attemptId}/submit`);

      // Clear local in-progress drafts
      try {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`quizforge_code_answers_${attemptId}`);
        localStorage.removeItem(`quizforge_code_evals_${attemptId}`);
        localStorage.removeItem('quizforge_last_active_code_attempt');
      } catch {
        // safe
      }

      navigate(`/code-quiz/${attemptId}/results`);
    } catch (err: unknown) {
      alert(err instanceof ApiError ? err.message : 'Failed to finalize code review.');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout activeNav="code-review">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 text-[#1935CA] animate-spin mb-4" />
          <h2 className="text-xl font-bold text-[#1935CA] mb-1">Loading Code Assessment...</h2>
          <p className="text-sm text-[#696F79]">
            Preparing repository context and code snippets
          </p>
        </div>
      </AppLayout>
    );
  }

  if (error || !attempt || !currentQuestion) {
    return (
      <AppLayout activeNav="code-review">
        <div className="max-w-md mx-auto text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold text-[#1E293B] mb-2">Code Quiz Unavailable</h2>
          <p className="text-xs text-[#696F79] mb-6">{error || 'Attempt could not be found.'}</p>
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

  const currentEval = evaluations[currentQuestion.id];
  const evaluatedCount = Object.keys(evaluations).filter((k) => evaluations[k] !== null).length;
  const totalQuestions = attempt.questions.length;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  // Split lines for snippet viewer
  const codeLines = (currentQuestion.codeSnippetContent || '').split('\n');
  const startLine = currentQuestion.codeSnippetStartLine ?? 1;

  return (
    <AppLayout activeNav="code-review">
      <div className="space-y-6">
        {/* ===================== TOP HEADER & BREADCRUMB BAR ===================== */}
        <div className="bg-white dark:bg-[#151C2C] rounded-[20px] p-4 sm:p-5 shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100/80 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors duration-200">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-medium text-[#696F79] dark:text-slate-400 flex-wrap">
            <Link to="/" className="hover:text-[#1935CA] dark:hover:text-[#38BDF8] transition font-semibold">
              Dashboard
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
            <span>GitHub Code Reviews</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
            <span className="font-bold text-[#1935CA] dark:text-[#38BDF8] font-mono">
              {attempt.repoUrl.replace('https://github.com/', '')}
            </span>
          </div>

          {/* Interactive Question Matrix Palette Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 p-1 bg-[#F8F9FC] dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
              {attempt.questions.map((q, idx) => {
                const isSelected = idx === currentIndex;
                const isAnswered = Boolean(evaluations[q.id]);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                      isSelected
                        ? 'bg-[#1935CA] text-white shadow-md'
                        : isAnswered
                        ? 'bg-[#ECFDF5] dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
                        : 'bg-white dark:bg-[#151C2C] text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white border border-slate-200 dark:border-slate-700'
                    }`}
                    title={`Question ${idx + 1}: ${isAnswered ? 'Evaluated' : 'Pending'}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Submit Review Button */}
            <button
              type="button"
              onClick={() => setIsSubmitModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#1935CA] hover:bg-[#142BA3] text-white text-xs font-bold shadow-[0_8px_20px_rgba(25,53,202,0.22)] transition flex items-center gap-1.5 active:scale-98"
            >
              <span>Submit Review</span>
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ===================== 2-COLUMN MAIN WORKSPACE (lg:grid-cols-12) ===================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ===================== LEFT: CODE SNIPPET VIEWER (lg:col-span-7) ===================== */}
          <div className="lg:col-span-7 bg-white dark:bg-[#151C2C] rounded-[20px] p-5 sm:p-6 shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100/80 dark:border-slate-800 space-y-4 transition-colors duration-200">
            {/* Snippet Header */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8]" />
                <span className="font-mono text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC] break-all">
                  {currentQuestion.codeSnippetPath}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-[#696F79] dark:text-slate-400">
                  Lines {startLine}–{startLine + codeLines.length - 1}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    currentQuestion.difficulty === 'hard'
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                      : currentQuestion.difficulty === 'medium'
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  {currentQuestion.difficulty}
                </span>
              </div>
            </div>

            {/* High-Contrast Code Snippet Container (Recent Quiz.png Reference - forced dark) */}
            <div className="bg-[#0F172A] text-slate-100 rounded-xl overflow-hidden shadow-inner border border-slate-800" style={{ colorScheme: 'only dark' }}>
              <div className="px-4 py-2 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Code Excerpt</span>
                <span>UTF-8 • Read-only</span>
              </div>
              <div className="overflow-x-auto p-4 text-xs font-mono leading-relaxed max-h-[500px] overflow-y-auto">
                <table className="w-full border-collapse">
                  <tbody>
                    {codeLines.map((line: string, idx: number) => {
                      const lineNum = startLine + idx;
                      return (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="pr-4 text-right text-slate-600 select-none align-top w-10 border-r border-slate-800/80">
                            {lineNum}
                          </td>
                          <td className="pl-4 whitespace-pre text-slate-200 align-top">
                            {line || ' '}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ===================== RIGHT: ADVERSARIAL QUESTION & EVALUATION (lg:col-span-5) ===================== */}
          <div className="lg:col-span-5 bg-white dark:bg-[#151C2C] rounded-[20px] p-5 sm:p-6 shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100/80 dark:border-slate-800 space-y-5 transition-colors duration-200">
            {/* Question Header */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-3 py-1 rounded-full bg-[#EEF2FF] dark:bg-slate-800 text-[#1935CA] dark:text-[#38BDF8] text-xs font-bold">
                  Question {currentIndex + 1} of {totalQuestions}
                </span>
                <span className="text-[11px] font-semibold text-[#696F79] dark:text-slate-400">
                  {currentEval ? 'Evaluated by LLM' : 'Awaiting Answer'}
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-[#1E293B] dark:text-[#F8FAFC] leading-snug">
                {currentQuestion.questionText}
              </h3>
            </div>

            {/* Answer Textarea */}
            <div>
              <label className="block text-xs font-bold text-[#1E293B] dark:text-slate-200 mb-1.5">
                Your Code Explanation / Defense:
              </label>
              <textarea
                rows={5}
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(e.target.value)}
                placeholder="Explain the intent, architectural trade-offs, edge cases, and why this snippet is constructed this way..."
                className="w-full p-3.5 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] text-[#1E293B] dark:text-[#F8FAFC] placeholder-[#94A3B8] dark:placeholder-slate-500 text-sm border border-slate-200/80 dark:border-slate-700 focus:ring-2 focus:ring-[#1935CA] focus:bg-white dark:focus:bg-[#1E293B] transition outline-none font-medium resize-y"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleEvaluateCurrent}
                disabled={isEvaluating || !(answers[currentQuestion.id]?.trim())}
                className="px-5 py-2.5 rounded-xl bg-[#1935CA] hover:bg-[#142BA3] text-white text-xs font-bold shadow-[0_8px_20px_rgba(25,53,202,0.22)] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 active:scale-98"
              >
                {isEvaluating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Grading with LLM...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Evaluate with LLM</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="p-2 rounded-xl bg-[#F8F9FC] dark:bg-slate-800 text-[#1E293B] dark:text-[#F8FAFC] hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition"
                  title="Previous Question"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                  disabled={isLastQuestion}
                  className="p-2 rounded-xl bg-[#F8F9FC] dark:bg-slate-800 text-[#1E293B] dark:text-[#F8FAFC] hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition"
                  title="Next Question"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Inline Instant Grading Critique (Recent Quiz.png Reference) */}
            {currentEval && (
              <div className="p-4 rounded-xl bg-[#F8F9FC] dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-3.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC] uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8]" />
                    <span>Rubric Score</span>
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                      (currentEval.score ?? 0) >= 7
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : (currentEval.score ?? 0) >= 4
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {currentEval.score ?? 0} / 10
                  </span>
                </div>

                {/* Rubric Progress Bars */}
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-[#696F79] dark:text-slate-400 mb-1">
                      <span>Accuracy</span>
                      <span>{currentEval.accuracy_score ?? 0} / 4</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, ((currentEval.accuracy_score ?? 0) / 4) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-[#696F79] dark:text-slate-400 mb-1">
                      <span>Depth</span>
                      <span>{currentEval.depth_score ?? 0} / 3</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[#1935CA] h-1.5 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, ((currentEval.depth_score ?? 0) / 3) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-[#696F79] dark:text-slate-400 mb-1">
                      <span>Completeness</span>
                      <span>{currentEval.completeness_score ?? 0} / 3</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[#38BDF8] h-1.5 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, ((currentEval.completeness_score ?? 0) / 3) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Key Concepts Identified vs Missed */}
                {((currentEval.key_concepts_identified && currentEval.key_concepts_identified.length > 0) ||
                  (currentEval.key_concepts_missed && currentEval.key_concepts_missed.length > 0)) && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2">
                    {currentEval.key_concepts_identified && currentEval.key_concepts_identified.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                          Concepts Identified:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {currentEval.key_concepts_identified.map((c, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-medium"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {currentEval.key_concepts_missed && currentEval.key_concepts_missed.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block mb-1">
                          Concepts Missed:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {currentEval.key_concepts_missed.map((c, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 text-[10px] font-medium"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Constructive LLM Feedback */}
                {currentEval.feedback && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] font-bold text-[#696F79] dark:text-slate-400 uppercase tracking-wider block mb-1">
                      Critique & Feedback:
                    </span>
                    <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed font-medium">
                      {currentEval.feedback}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================== SUBMISSION MODAL ===================== */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#151C2C] rounded-[24px] max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 dark:border-slate-800 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] dark:bg-slate-800 text-[#1935CA] dark:text-[#38BDF8] flex items-center justify-center mx-auto mb-4">
              <Send className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-extrabold text-[#1935CA] dark:text-[#38BDF8] tracking-tight mb-2">
              Finalize Code Review?
            </h3>
            <p className="text-xs text-[#696F79] dark:text-slate-400 leading-relaxed mb-5">
              You have evaluated <strong>{evaluatedCount} of {totalQuestions}</strong> questions with the LLM. Once submitted, your scores and mastery badges will be finalized.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                disabled={isSubmitting}
                className="w-1/2 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#1E293B] dark:text-[#F8FAFC] font-bold text-xs transition"
              >
                Keep Reviewing
              </button>
              <button
                type="button"
                onClick={handleSubmitAttempt}
                disabled={isSubmitting}
                className="w-1/2 py-2.5 rounded-xl bg-[#1935CA] hover:bg-[#142BA3] text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit Final</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
