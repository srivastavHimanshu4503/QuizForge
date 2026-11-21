import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient, ApiError } from '../api/client';
import { Navbar } from '../components/layout/Navbar';
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
} from 'lucide-react';

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
        // Unpublish
        const res = await apiClient.post<{ status: 'draft' }>(`/api/quizzes/${quizId}/unpublish`);
        if (quiz) {
          setQuiz({ ...quiz, status: res.status });
        }
      } else {
        // Publish
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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-24">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/history"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to History</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTakeQuiz}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Take Quiz</span>
            </button>
          </div>
        </div>

        {/* Studio Header Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                <SlidersHorizontal className="w-6 h-6" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[11px] font-bold uppercase tracking-wider mb-1">
                  <span>Review & Publishing Studio</span>
                </div>
                <h1 className="text-2xl font-black text-white">Quiz Studio</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Status Badge */}
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${
                  quiz?.status === 'published'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}
              >
                {quiz?.status === 'published' ? 'Published' : 'Draft'}
              </span>

              {/* Publish Toggle Button */}
              <button
                type="button"
                onClick={handleTogglePublish}
                disabled={isPublishing}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  quiz?.status === 'published'
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
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
                className="px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:hover:bg-violet-600 text-white shadow-lg shadow-violet-600/20 transition flex items-center gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>

          {/* Share Code Section if Published */}
          {quiz?.status === 'published' && quiz.shareCode && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Share2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    Public Share Link Active
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Anyone with this link can attempt this quiz without modifying your master copy.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Copied!' : 'Copy Share Link'}</span>
              </button>
            </div>
          )}

          {/* Messages */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start gap-2.5 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Topic & Metadata Form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="quiz-topic" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Quiz Title
              </label>
              <input
                id="quiz-topic"
                type="text"
                value={topic}
                onChange={(e) => handleTopicChange(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-violet-500 text-sm font-semibold text-white transition outline-none"
              />
            </div>

            <div>
              <label htmlFor="quiz-diff" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Target Difficulty
              </label>
              <select
                id="quiz-diff"
                value={difficulty}
                onChange={(e) => handleDifficultyChange(e.target.value as QuizDifficulty)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-violet-500 text-sm text-white transition outline-none"
              >
                <option value="easy">Easy (Fundamentals)</option>
                <option value="medium">Medium (Application)</option>
                <option value="hard">Hard (Advanced)</option>
                <option value="mixed">Mixed Tiers</option>
              </select>
            </div>
          </div>
        </div>

        {/* Questions Editor List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Questions & Answer Choices</span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-bold">
                {questions.length}
              </span>
            </h2>

            <button
              type="button"
              onClick={handleAddQuestion}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Question</span>
            </button>
          </div>

          {questions.map((q, qIndex) => (
            <div
              key={q.id || `q_${qIndex}`}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md hover:border-slate-700/80 transition"
            >
              {/* Question Header & Action Buttons */}
              <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/80">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-400">
                  Question {qIndex + 1}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveQuestion(qIndex, 'up')}
                    disabled={qIndex === 0}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition"
                    title="Move Question Up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveQuestion(qIndex, 'down')}
                    disabled={qIndex === questions.length - 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition"
                    title="Move Question Down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(qIndex)}
                    disabled={questions.length <= 1}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 disabled:opacity-30 transition ml-2"
                    title="Delete Question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <div className="mb-5">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Question Prompt
                </label>
                <textarea
                  value={q.questionText}
                  onChange={(e) => handleQuestionTextChange(qIndex, e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-violet-500 text-sm text-white transition outline-none"
                />
              </div>

              {/* Choices List */}
              <div className="space-y-3 mb-5">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Choices (Select the Radio Button for the Correct Answer)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {q.choices.map((c) => {
                    const isCorrect = q.correctChoiceId === c.choice_id;
                    return (
                      <div
                        key={c.choice_id}
                        onClick={() => handleCorrectChoiceChange(qIndex, c.choice_id)}
                        className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                          isCorrect
                            ? 'bg-emerald-950/20 border-emerald-500/50'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isCorrect
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {c.choice_id}
                        </div>
                        <input
                          type="text"
                          value={c.option_text}
                          onChange={(e) =>
                            handleChoiceTextChange(qIndex, c.choice_id, e.target.value)
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 bg-transparent border-none text-sm text-white focus:outline-none"
                        />
                        {isCorrect && (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">
                            Correct
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pedagogical Explanation */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Educational Explanation
                </label>
                <textarea
                  value={q.explanation}
                  onChange={(e) => handleExplanationChange(qIndex, e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-violet-500 text-xs text-slate-300 transition outline-none"
                />
              </div>
            </div>
          ))}

          {/* Add Question Button */}
          <button
            type="button"
            onClick={handleAddQuestion}
            className="w-full py-4 rounded-3xl border-2 border-dashed border-slate-800 hover:border-violet-500/50 text-slate-400 hover:text-violet-300 text-sm font-bold flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Another Question</span>
          </button>
        </div>
      </main>

      {/* Sticky Bottom Bar for Unsaved Changes */}
      {isDirty && (
        <div className="fixed bottom-0 inset-x-0 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md p-4 z-40 animate-in slide-in-from-bottom duration-200">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>You have unsaved edits in Review Studio</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 shadow-md shadow-violet-600/20 transition flex items-center gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Edits</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
