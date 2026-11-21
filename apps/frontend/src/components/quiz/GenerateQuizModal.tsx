import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, ApiError } from '../../api/client';
import { QuizDifficulty } from '@quiz-forge/shared';
import { Sparkles, Brain, Loader2, X, AlertCircle } from 'lucide-react';

interface GenerateQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export function GenerateQuizModal({ isOpen, onClose }: GenerateQuizModalProps) {
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('mixed');
  const [provider, setProvider] = useState<string>('groq');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
      navigate(`/quiz/${data.attemptId}`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          disabled={isGenerating}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Create AI-Powered Quiz
            </h2>
            <p className="text-xs text-slate-400">
              Powered by Google Gemini 2.5 Flash
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-3 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Topic Input */}
          <div>
            <label
              htmlFor="topic"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
            >
              Quiz Topic
            </label>
            <input
              id="topic"
              type="text"
              required
              disabled={isGenerating}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Distributed Consensus, Python Metaprogramming..."
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />

            {/* Presets */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {TOPIC_PRESETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setTopic(t)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/60 text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-slate-700/60 hover:border-indigo-500/30 transition"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Question Count */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Number of Questions: <strong className="text-indigo-400">{questionCount}</strong>
            </label>
            <div className="grid grid-cols-4 gap-2.5">
              {COUNT_PRESETS.map((count) => (
                <button
                  key={count}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setQuestionCount(count)}
                  className={`py-2 rounded-xl text-xs font-semibold border transition ${
                    questionCount === count
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {count} MCQs
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty Level */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
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
                      ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <p
                    className={`text-xs font-bold ${
                      difficulty === d.id ? 'text-indigo-400' : 'text-white'
                    }`}
                  >
                    {d.label}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    {d.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* AI Model Provider */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center justify-between">
              <span>AI Engine / Model</span>
              <span className="text-[10px] text-cyan-400 font-mono">Multi-LLM Registry</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => setProvider('groq')}
                className={`p-2.5 rounded-xl text-left border transition ${
                  provider === 'groq'
                    ? 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${provider === 'groq' ? 'text-amber-400' : 'text-white'}`}>
                    Groq
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                    Fastest
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">GPT-OSS-120B</p>
              </button>

              <button
                type="button"
                disabled={isGenerating}
                onClick={() => setProvider('gemini')}
                className={`p-2.5 rounded-xl text-left border transition ${
                  provider === 'gemini'
                    ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${provider === 'gemini' ? 'text-indigo-400' : 'text-white'}`}>
                    Gemini
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                    Multimodal
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">2.5 Flash</p>
              </button>

              <button
                type="button"
                disabled={isGenerating}
                onClick={() => setProvider('nvidia')}
                className={`p-2.5 rounded-xl text-left border transition ${
                  provider === 'nvidia'
                    ? 'bg-emerald-500/15 border-emerald-500 ring-1 ring-emerald-500'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${provider === 'nvidia' ? 'text-emerald-400' : 'text-white'}`}>
                    NVIDIA NIM
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                    Cloud
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Llama 3.3 70B</p>
              </button>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Questions with {provider === 'groq' ? 'Groq (GPT-OSS-120B)' : provider === 'gemini' ? 'Gemini 2.5 Flash' : 'AI'}...</span>
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
