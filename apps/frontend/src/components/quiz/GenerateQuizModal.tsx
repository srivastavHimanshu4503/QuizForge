import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, ApiError } from '../../api/client';
import { QuizDifficulty } from '@quiz-forge/shared';
import { Sparkles, Brain, Loader2, X, AlertCircle } from 'lucide-react';

interface ProviderOption {
  id: string;
  name: string;
  displayName: string;
  defaultModel: string;
  isAvailable: boolean;
  supportsVision?: boolean;
}

interface GenerateQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuizCreated?: (quizId: string, topic?: string) => void;
}

const TOPIC_PRESETS = [
  'TypeScript Advanced Types',
  'Rust Concurrency & Borrowing',
  'Distributed Systems & Raft',
  'PostgreSQL Indexing & Optimization',
  'System Design & Microservices',
  'React 19 Server Components',
];

const COUNT_PRESETS = [3, 5, 10, 15];

const DIFFICULTIES: Array<{ id: QuizDifficulty; label: string; desc: string }> = [
  { id: 'easy', label: 'Easy', desc: 'Core fundamentals & definitions' },
  { id: 'medium', label: 'Medium', desc: 'Conceptual application' },
  { id: 'hard', label: 'Hard', desc: 'Edge cases & deep mechanics' },
  { id: 'mixed', label: 'Mixed', desc: 'Balanced variety across tiers' },
];

export function GenerateQuizModal({ isOpen, onClose, onQuizCreated }: GenerateQuizModalProps) {
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('mixed');
  const [provider, setProvider] = useState<string>('groq');
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      apiClient
        .get<{ providers: ProviderOption[] }>('/api/llm/providers')
        .then((data) => {
          setProviders(data.providers);
          const firstAvail = data.providers.find((p) => p.isAvailable);
          if (firstAvail) {
            setProvider(firstAvail.id);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isGenerating) return;
    setError(null);

    if (!topic.trim()) {
      setError('Please enter a topic.');
      return;
    }

    setIsGenerating(true);
    try {
      const data = await apiClient.post<{
        quizId: string;
        attemptId: string;
        totalQuestions: number;
        status: string;
      }>('/api/quizzes/generate', {
        topic: topic.trim(),
        questionCount,
        difficulty,
        provider,
      });

      // Save initial attempt info to localStorage so it is resilient across reloads
      try {
        localStorage.setItem(
          'quizforge_last_active_attempt',
          JSON.stringify({
            attemptId: data.attemptId,
            topic: topic.trim(),
            totalQuestions: data.totalQuestions,
            updatedAt: Date.now(),
          })
        );
      } catch {
        // safe
      }

      onClose();
      if (onQuizCreated) {
        onQuizCreated(data.quizId, topic.trim());
      } else {
        navigate(`/quiz/${data.attemptId}`);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Failed to generate quiz. Please check your network or try a different topic.';
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[24px] max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1935CA] text-white flex items-center justify-center shadow-md">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-[#1935CA] tracking-tight">
                Create AI Topic Quiz
              </h3>
              <p className="text-xs text-[#696F79] font-medium">
                Multiple-choice questions generated and graded on demand
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-5 p-3.5 rounded-xl bg-[#FEF2F2] border border-rose-200 flex items-start gap-2.5 text-rose-700 text-xs font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Topic Input */}
          <div>
            <label
              htmlFor="topic"
              className="block text-xs font-bold text-[#1E293B] mb-1.5"
            >
              Quiz Topic *
            </label>
            <input
              id="topic"
              type="text"
              required
              disabled={isGenerating}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Distributed Consensus, Python Metaprogramming..."
              className="w-full px-4 py-3 rounded-xl bg-[#F8F9FC] text-[#1E293B] placeholder-[#94A3B8] text-sm border border-slate-200/80 focus:ring-2 focus:ring-[#1935CA] focus:bg-white transition outline-none font-medium"
            />

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <span className="text-[11px] font-semibold text-[#696F79]">Presets:</span>
              {TOPIC_PRESETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setTopic(t)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-[#F8F9FC] text-[#1E293B] hover:text-[#1935CA] hover:bg-[#EEF2FF] border border-slate-200/80 font-medium transition"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Question Count */}
          <div>
            <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
              Number of Questions: <strong className="text-[#1935CA]">{questionCount}</strong>
            </label>
            <div className="grid grid-cols-4 gap-2.5">
              {COUNT_PRESETS.map((count) => (
                <button
                  key={count}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setQuestionCount(count)}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    questionCount === count
                      ? 'bg-[#1935CA] text-white border-[#1935CA] shadow-sm'
                      : 'bg-[#F8F9FC] text-[#696F79] border-slate-200/80 hover:bg-slate-100 hover:text-[#1E293B]'
                  }`}
                >
                  {count} MCQs
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty Level */}
          <div>
            <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
              Difficulty Tier
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setDifficulty(d.id)}
                  className={`p-3 rounded-xl text-left border transition ${
                    difficulty === d.id
                      ? 'bg-[#EEF2FF] border-[#1935CA] ring-1 ring-[#1935CA]'
                      : 'bg-[#F8F9FC] border-slate-200/80 hover:bg-slate-100'
                  }`}
                >
                  <p
                    className={`text-xs font-bold ${
                      difficulty === d.id ? 'text-[#1935CA]' : 'text-[#1E293B]'
                    }`}
                  >
                    {d.label}
                  </p>
                  <p className="text-[10px] text-[#696F79] mt-0.5 leading-tight">
                    {d.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* AI Model Provider */}
          <div>
            <label className="block text-xs font-bold text-[#1E293B] mb-1.5 flex items-center justify-between">
              <span>AI Engine / Model</span>
              <span className="text-[10px] text-[#1935CA] font-mono font-semibold">Multi-LLM Registry</span>
            </label>
            {providers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {providers.map((p) => {
                  const cleanModelName = p.defaultModel.replace(/^(openai|meta|nvidia|google)\//i, '');
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isGenerating || !p.isAvailable}
                      onClick={() => setProvider(p.id)}
                      className={`p-3 rounded-xl text-left border transition ${
                        provider === p.id
                          ? 'bg-[#EEF2FF] border-[#1935CA] ring-2 ring-[#1935CA]'
                          : p.isAvailable
                          ? 'bg-[#F8F9FC] border-slate-200/80 hover:bg-slate-100'
                          : 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold truncate ${provider === p.id ? 'text-[#1935CA]' : 'text-[#1E293B]'}`}>
                          {p.name.toUpperCase()}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                            p.isAvailable
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {p.isAvailable ? 'Ready' : 'Offline'}
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-[#1E293B] mt-1 font-mono truncate" title={p.defaultModel}>
                        {cleanModelName}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 font-medium">
                Loading available models from environment...
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] transition shadow-lg shadow-[#1935CA]/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    Generating Questions with{' '}
                    {providers.find((p) => p.id === provider)?.displayName || provider.toUpperCase()}...
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate & Start Quiz</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
