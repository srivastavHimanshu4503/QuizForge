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
    const answerText = answers[currentQuestion.id] || '';

    if (!answerText.trim()) {
      alert('Please write an answer before requesting an LLM evaluation.');
      return;
    }

    setIsEvaluating(true);
    try {
      const evalResult = await apiClient.post<AnswerEvaluation>(
        `/api/code-quizzes/attempts/${attemptId}/answers`,
        {
          questionId: currentQuestion.id,
          answer: answerText.trim(),
        }
      );

      setEvaluations((prev) => ({
        ...prev,
        [currentQuestion.id]: evalResult,
      }));

      // Update question in local state
      if (attempt) {
        const updatedQuestions = attempt.questions.map((q) =>
          q.id === currentQuestion.id
            ? { ...q, score: evalResult.score, feedback: evalResult.feedback, userAnswer: answerText }
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
        <div className="bg-white rounded-[20px] p-4 sm:p-5 shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-medium text-[#696F79] flex-wrap">
            <Link to="/" className="hover:text-[#1935CA] transition font-semibold">
              Dashboard
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span>GitHub Code Reviews</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="font-bold text-[#1935CA] font-mono">
              {attempt.repoUrl.replace('https://github.com/', '')}
            </span>
          </div>

          {/* Interactive Question Matrix Palette Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 p-1 bg-[#F8F9FC] rounded-xl border border-slate-100">
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
                        ? 'bg-[#ECFDF5] text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                        : 'bg-white text-[#696F79] hover:text-[#1E293B] border border-slate-200'
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
          <div className="lg:col-span-7 bg-white rounded-[20px] p-5 sm:p-6 shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100/80 space-y-4">
            {/* Snippet Header */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-[#1935CA]" />
                <span className="font-mono text-xs font-bold text-[#1E293B] break-all">
                  {currentQuestion.codeSnippetPath}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-[#696F79]">
                  Lines {startLine}–{startLine + codeLines.length - 1}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    currentQuestion.difficulty === 'hard'
                      ? 'bg-rose-50 text-rose-600 border border-rose-200'
                      : currentQuestion.difficulty === 'medium'
                      ? 'bg-amber-50 text-amber-600 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  }`}
                >
                  {currentQuestion.difficulty}
                </span>
              </div>
            </div>

            {/* High-Contrast Code Snippet Container (Recent Quiz.png Reference) */}
            <div className="bg-[#0F172A] text-slate-100 rounded-xl overflow-hidden shadow-inner border border-slate-800">
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
          <div className="lg:col-span-5 bg-white rounded-[20px] p-5 sm:p-6 shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100/80 space-y-5">
            {/* Question Header */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-3 py-1 rounded-full bg-[#EEF2FF] text-[#1935CA] text-xs font-bold">
                  Question {currentIndex + 1} of {totalQuestions}
                </span>
                <span className="text-[11px] font-semibold text-[#696F79]">
                  {currentEval ? 'Evaluated by LLM' : 'Awaiting Answer'}
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-[#1E293B] leading-snug">
                {currentQuestion.questionText}
              </h3>
            </div>

            {/* Answer Textarea */}
            <div>
              <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
                Your Code Explanation / Defense:
              </label>
              <textarea
                rows={5}
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(e.target.value)}
                placeholder="Explain the intent, architectural trade-offs, edge cases, and why this snippet is constructed this way..."
                className="w-full p-3.5 rounded-xl bg-[#F8F9FC] text-[#1E293B] placeholder-[#94A3B8] text-sm border border-slate-200/80 focus:ring-2 focus:ring-[#1935CA] focus:bg-white transition outline-none font-medium resize-y"
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
                  className="p-2 rounded-xl bg-[#F8F9FC] text-[#1E293B] hover:bg-slate-200 disabled:opacity-30 transition"
                  title="Previous Question"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                  disabled={isLastQuestion}
                  className="p-2 rounded-xl bg-[#F8F9FC] text-[#1E293B] hover:bg-slate-200 disabled:opacity-30 transition"
                  title="Next Question"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Inline Instant Grading Critique (Recent Quiz.png Reference) */}
            {currentEval && (
              <div className="p-4 rounded-xl bg-[#F8F9FC] border border-slate-200/80 space-y-3.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[#1935CA]" />
                    <span>Rubric Score</span>
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                      currentEval.score >= 7
                        ? 'bg-emerald-100 text-emerald-700'
                        : currentEval.score >= 4
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {currentEval.score} / 10
                  </span>
                </div>

                {/* Rubric Progress Bars */}
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-[#696F79] mb-1">
                      <span>Accuracy</span>
                      <span>{currentEval.accuracy_score || (currentEval.score >= 7 ? 4 : 2)} / 4</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full"
                        style={{
                          width: `${((currentEval.accuracy_score || (currentEval.score >= 7 ? 4 : 2)) / 4) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-[#696F79] mb-1">
                      <span>Depth</span>
                      <span>{currentEval.depth_score || (currentEval.score >= 7 ? 3 : 1)} / 3</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[#1935CA] h-1.5 rounded-full"
                        style={{
                          width: `${((currentEval.depth_score || (currentEval.score >= 7 ? 3 : 1)) / 3) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold text-[#696F79] mb-1">
                      <span>Completeness</span>
                      <span>{currentEval.completeness_score || (currentEval.score >= 7 ? 3 : 1)} / 3</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[#38BDF8] h-1.5 rounded-full"
                        style={{
                          width: `${((currentEval.completeness_score || (currentEval.score >= 7 ? 3 : 1)) / 3) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Constructive LLM Feedback */}
                <div className="pt-2 border-t border-slate-200/60">
                  <p className="text-xs text-[#475569] leading-relaxed font-medium">
                    {currentEval.feedback}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================== SUBMISSION MODAL ===================== */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[24px] max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] text-[#1935CA] flex items-center justify-center mx-auto mb-4">
              <Send className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-extrabold text-[#1935CA] tracking-tight mb-2">
              Finalize Code Review?
            </h3>
            <p className="text-xs text-[#696F79] leading-relaxed mb-5">
              You have evaluated <strong>{evaluatedCount} of {totalQuestions}</strong> questions with the LLM. Once submitted, your scores and mastery badges will be finalized.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                disabled={isSubmitting}
                className="w-1/2 py-2.5 rounded-xl bg-[#F8F9FC] hover:bg-slate-200 text-[#1E293B] font-bold text-xs transition"
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
