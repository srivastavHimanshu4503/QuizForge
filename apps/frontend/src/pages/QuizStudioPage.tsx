import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient, ApiError } from '../api/client';
import { AppLayout } from '../components/layout/AppLayout';
import {
  ChoiceId,
  QuizStudioPayload,
  StudioQuestion,
  QuizDifficulty,
} from '@quiz-forge/shared';
import {
  SlidersHorizontal,
  Save,
  Globe,
  Share2,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Play,
  Copy,
  Check,
  ChevronLeft,
  Package,
  BarChart3,
} from 'lucide-react';
import { ScormExportModal } from '../components/lms/ScormExportModal';
import { InstitutionalPsychometricsModal } from '../components/lms/InstitutionalPsychometricsModal';

export function QuizStudioPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<QuizStudioPayload | null>(null);
  const [questions, setQuestions] = useState<StudioQuestion[]>([]);
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('mixed');
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isScormModalOpen, setIsScormModalOpen] = useState(false);
  const [isPsychometricsModalOpen, setIsPsychometricsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!quizId) return;
    setIsLoading(true);
    apiClient
      .get<QuizStudioPayload>(`/api/quizzes/${quizId}/studio`)
      .then((data) => {
        setQuiz(data);
        setTopic(data.topic);
        setDifficulty(data.difficulty);
        setIsPublic(data.isPublic);
        setQuestions(data.questions);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        setIsLoading(false);
        setError(err instanceof ApiError ? err.message : 'Failed to load quiz in Review Studio.');
      });
  }, [quizId]);

  const handleTopicChange = (newTopic: string) => {
    setTopic(newTopic);
    setIsDirty(true);
  };

  const handleDifficultyChange = (newDiff: QuizDifficulty) => {
    setDifficulty(newDiff);
    setIsDirty(true);
  };

  const handleQuestionTextChange = (index: number, text: string) => {
    const updated = [...questions];
    const q = updated[index];
    if (q) {
      updated[index] = { ...q, questionText: text };
      setQuestions(updated);
      setIsDirty(true);
    }
  };

  const handleChoiceTextChange = (qIndex: number, choiceId: ChoiceId, text: string) => {
    const updated = [...questions];
    const q = updated[qIndex];
    if (q) {
      const newChoices = q.choices.map((c) =>
        c.choice_id === choiceId ? { ...c, option_text: text } : c
      );
      updated[qIndex] = { ...q, choices: newChoices };
      setQuestions(updated);
      setIsDirty(true);
    }
  };

  const handleCorrectChoiceChange = (qIndex: number, choiceId: ChoiceId) => {
    const updated = [...questions];
    const q = updated[qIndex];
    if (q) {
      updated[qIndex] = { ...q, correctChoiceId: choiceId };
      setQuestions(updated);
      setIsDirty(true);
    }
  };

  const handleExplanationChange = (qIndex: number, text: string) => {
    const updated = [...questions];
    const q = updated[qIndex];
    if (q) {
      updated[qIndex] = { ...q, explanation: text };
      setQuestions(updated);
      setIsDirty(true);
    }
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...questions];
    const currentQ = updated[index];
    const targetQ = updated[targetIndex];

    if (currentQ && targetQ) {
      updated[index] = targetQ;
      updated[targetIndex] = currentQ;
      setQuestions(updated);
      setIsDirty(true);
    }
  };

  const handleDeleteQuestion = (index: number) => {
    if (questions.length <= 1) {
      alert('A quiz must contain at least 1 question.');
      return;
    }
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
    setIsDirty(true);
  };

  const handleAddQuestion = () => {
    const newQ: StudioQuestion = {
      id: crypto.randomUUID(),
      questionText: 'New question text...',
      choices: [
        { choice_id: 'A', option_text: 'Option A' },
        { choice_id: 'B', option_text: 'Option B' },
        { choice_id: 'C', option_text: 'Option C' },
        { choice_id: 'D', option_text: 'Option D' },
      ],
      correctChoiceId: 'A',
      explanation: 'Explanation for why Option A is the correct answer.',
    };
    setQuestions([...questions, newQ]);
    setIsDirty(true);
  };

  const handleSaveChanges = async () => {
    if (!quizId) return;
    setError(null);
    setSuccessMsg(null);
    setIsSaving(true);

    try {
      const updated = await apiClient.put<QuizStudioPayload>(`/api/quizzes/${quizId}/studio`, {
        topic: topic.trim(),
        difficulty,
        isPublic,
        questions,
      });
      setQuiz(updated);
      setQuestions(updated.questions);
      setIsDirty(false);
      setIsSaving(false);
      setSuccessMsg('All quiz changes saved successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setIsSaving(false);
      setError(err instanceof ApiError ? err.message : 'Failed to save changes.');
    }
  };

  const handleTogglePublish = async () => {
    if (!quizId) return;
    setIsPublishing(true);
    setError(null);

    try {
      if (quiz?.status === 'published') {
        const res = await apiClient.post<{ status: 'draft' }>(`/api/quizzes/${quizId}/unpublish`);
        if (quiz) {
          setQuiz({ ...quiz, status: res.status });
        }
      } else {
        const res = await apiClient.post<{ status: 'published'; shareCode: string }>(
          `/api/quizzes/${quizId}/publish`
        );
        if (quiz) {
          setQuiz({ ...quiz, status: res.status, shareCode: res.shareCode, isPublic: true });
          setIsPublic(true);
        }
      }
      setIsPublishing(false);
    } catch (err: unknown) {
      setIsPublishing(false);
      setError(err instanceof ApiError ? err.message : 'Failed to toggle publishing status.');
    }
  };

  const handleCopyShareLink = () => {
    if (!quiz?.shareCode) return;
    const shareUrl = `${window.location.origin}/quiz/shared/${quiz.shareCode}`;
    navigator.clipboard.writeText(shareUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleTakeQuiz = async () => {
    if (!quizId) return;
    try {
      const data = await apiClient.post<{ attemptId: string }>(`/api/quizzes/${quizId}/restart`);
      navigate(`/quiz/${data.attemptId}`);
    } catch {
      alert('Failed to launch quiz attempt.');
    }
  };

  if (isLoading) {
    return (
      <AppLayout activeNav="history">
        <div className="flex flex-col items-center justify-center p-12">
          <Loader2 className="w-8 h-8 text-[#1935CA] dark:text-indigo-400 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activeNav="history">
      <div className="space-y-6 pb-12">
        {/* Top Navigation */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <Link
            to="/history"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#696F79] dark:text-slate-400 hover:text-[#1935CA] dark:hover:text-indigo-400 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to History</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTakeQuiz}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC] bg-white dark:bg-[#151C2C] hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-sm transition"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Take Quiz</span>
            </button>
          </div>
        </div>

        {/* Studio Header Card */}
        <div className="bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 rounded-[20px] p-6 sm:p-8 shadow-[0_10px_30px_rgba(25,53,202,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-[#EEF2FF] dark:bg-indigo-950/50 text-[#1935CA] dark:text-indigo-300">
                <SlidersHorizontal className="w-6 h-6" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EEF2FF] dark:bg-indigo-950/50 text-[#1935CA] dark:text-indigo-300 text-[11px] font-bold uppercase tracking-wider mb-1">
                  <span>Review & Publishing Studio</span>
                </div>
                <h1 className="text-2xl font-black text-[#1E293B] dark:text-[#F8FAFC]">Quiz Studio</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Status Badge */}
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  quiz?.status === 'published'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50'
                }`}
              >
                {quiz?.status === 'published' ? 'Published' : 'Draft'}
              </span>

              {/* Institutional Psychometrics Button */}
              <button
                type="button"
                onClick={() => setIsPsychometricsModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-[#1935CA] dark:text-[#38BDF8] border border-indigo-200 dark:border-indigo-800 transition flex items-center gap-1.5"
                title="View Cronbach's Alpha and Item Point-Biserial Discrimination"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Psychometrics</span>
              </button>

              {/* Export SCORM Button */}
              <button
                type="button"
                onClick={() => setIsScormModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-[#151C2C] hover:bg-slate-50 dark:hover:bg-slate-800 text-[#1E293B] dark:text-[#F8FAFC] border border-slate-200 dark:border-slate-700 shadow-sm transition flex items-center gap-1.5"
                title="Export SCORM 1.2 / 2004 / xAPI Package"
              >
                <Package className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Export SCORM</span>
              </button>

              {/* Publish Toggle Button */}
              <button
                type="button"
                onClick={handleTogglePublish}
                disabled={isPublishing}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  quiz?.status === 'published'
                    ? 'bg-white dark:bg-[#151C2C] hover:bg-slate-50 dark:hover:bg-slate-800 text-[#1E293B] dark:text-[#F8FAFC] border border-slate-200 dark:border-slate-700 shadow-sm'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                }`}
              >
                {isPublishing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Globe className="w-3.5 h-3.5" />
                )}
                <span>{quiz?.status === 'published' ? 'Unpublish' : 'Publish Quiz'}</span>
              </button>

              {/* Save Button */}
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={isSaving || !isDirty}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1935CA] hover:bg-[#142BA3] disabled:opacity-50 text-white shadow-lg shadow-[#1935CA]/20 transition flex items-center gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>

          {/* Share Code Section if Published */}
          {quiz?.status === 'published' && quiz.shareCode && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Share2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    Public Share Link Active
                  </p>
                  <p className="text-xs text-[#696F79] dark:text-slate-400 mt-0.5">
                    Anyone with this link can attempt this quiz without modifying your master copy.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#151C2C] hover:bg-slate-50 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 shadow-sm text-xs font-bold flex items-center gap-1.5 transition"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Link Copied!' : 'Copy Share Link'}</span>
              </button>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Metadata Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC] mb-1.5">
                Quiz Topic / Title
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => handleTopicChange(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 text-sm text-[#1E293B] dark:text-[#F8FAFC] focus:ring-2 focus:ring-[#1935CA] focus:bg-white dark:focus:bg-[#151C2C] outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC] mb-1.5">
                Difficulty Level
              </label>
              <select
                value={difficulty}
                onChange={(e) => handleDifficultyChange(e.target.value as QuizDifficulty)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 text-sm text-[#1E293B] dark:text-[#F8FAFC] focus:ring-2 focus:ring-[#1935CA] focus:bg-white dark:focus:bg-[#151C2C] outline-none font-medium"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Questions Editor */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-[#1E293B] dark:text-[#F8FAFC]">
              Questions ({questions.length})
            </h2>
            <button
              type="button"
              onClick={handleAddQuestion}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] shadow-md shadow-[#1935CA]/20 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Question</span>
            </button>
          </div>

          {questions.map((q, idx) => (
            <div
              key={q.id || idx}
              className="bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 rounded-[20px] p-6 shadow-[0_10px_30px_rgba(25,53,202,0.05)] space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#1935CA] dark:text-indigo-400">
                  Question {idx + 1}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleMoveQuestion(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1 rounded-lg text-slate-400 hover:text-[#1935CA] dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition"
                    title="Move Up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveQuestion(idx, 'down')}
                    disabled={idx === questions.length - 1}
                    className="p-1 rounded-lg text-slate-400 hover:text-[#1935CA] dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition"
                    title="Move Down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(idx)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    title="Delete Question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <div>
                <label className="block text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC] mb-1">
                  Question Prompt
                </label>
                <textarea
                  rows={2}
                  value={q.questionText}
                  onChange={(e) => handleQuestionTextChange(idx, e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 text-sm text-[#1E293B] dark:text-[#F8FAFC] focus:ring-2 focus:ring-[#1935CA] focus:bg-white dark:focus:bg-[#151C2C] outline-none font-medium resize-none"
                />
              </div>

              {/* Choices */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC]">
                  Choices (Select radio for correct answer)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {q.choices.map((c) => {
                    const isCorrect = q.correctChoiceId === c.choice_id;
                    return (
                      <div
                        key={c.choice_id}
                        className={`p-3 rounded-xl border flex items-center gap-2.5 transition ${
                          isCorrect
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-200 dark:ring-emerald-800'
                            : 'bg-[#F8F9FC] dark:bg-[#1E293B] border-slate-200/80 dark:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`correct-${idx}`}
                          checked={isCorrect}
                          onChange={() => handleCorrectChoiceChange(idx, c.choice_id)}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                        />
                        <span className="font-bold text-xs text-[#1E293B] dark:text-[#F8FAFC] shrink-0">
                          {c.choice_id}:
                        </span>
                        <input
                          type="text"
                          value={c.option_text}
                          onChange={(e) =>
                            handleChoiceTextChange(idx, c.choice_id, e.target.value)
                          }
                          className="flex-1 bg-transparent text-xs text-[#1E293B] dark:text-[#F8FAFC] font-medium outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Explanation */}
              <div>
                <label className="block text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC] mb-1">
                  Pedagogical Explanation
                </label>
                <textarea
                  rows={2}
                  value={q.explanation}
                  onChange={(e) => handleExplanationChange(idx, e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 text-xs text-[#1E293B] dark:text-[#F8FAFC] focus:ring-2 focus:ring-[#1935CA] focus:bg-white dark:focus:bg-[#151C2C] outline-none font-medium resize-none"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {quizId && (
        <>
          <ScormExportModal
            isOpen={isScormModalOpen}
            onClose={() => setIsScormModalOpen(false)}
            quizId={quizId}
            quizTitle={topic || 'Quiz'}
          />
          <InstitutionalPsychometricsModal
            isOpen={isPsychometricsModalOpen}
            onClose={() => setIsPsychometricsModalOpen(false)}
            quizId={quizId}
          />
        </>
      )}
    </AppLayout>
  );
}
