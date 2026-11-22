import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, ApiError } from '../../api/client';
import { Target, Sparkles, Brain, AlertCircle, Loader2, X, Sliders, ShieldCheck } from 'lucide-react';

interface AdaptiveQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TOPIC_SUGGESTIONS = [
  'Distributed Systems & Consensus',
  'Full-Stack Architecture Patterns',
  'Data Structures & Algorithmic Complexity',
  'Kubernetes & Cloud Native Internals',
  'Web Security & Cryptographic Protocols',
  'Database Indexing & Query Optimization',
];

export function AdaptiveQuizModal({ isOpen, onClose }: AdaptiveQuizModalProps) {
  const navigate = useNavigate();

  const [topic, setTopic] = useState('');
  const [itemPoolSize, setItemPoolSize] = useState<number>(12);
  const [maxTestLength, setMaxTestLength] = useState<number>(8);
  const [provider, setProvider] = useState<'gemini' | 'groq' | 'nvidia'>('gemini');

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setError('Please provide a subject or topic for the adaptive test.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const res = await apiClient.post<{
        quizId: string;
        attemptId: string;
        topic: string;
        itemPoolSize: number;
        maxTestLength: number;
      }>('/api/quizzes/generate-adaptive', {
        topic: topic.trim(),
        itemPoolSize,
        maxTestLength,
        provider,
      });

      onClose();
      navigate(`/quiz/${res.attemptId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to create adaptive quiz. Please try again.');
      }
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-50/50 via-indigo-50/20 to-transparent dark:from-slate-800/40 dark:via-slate-800/10 dark:to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1935CA] text-white flex items-center justify-center shadow-md shadow-[#1935CA]/25">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Computerized Adaptive Testing (CAT)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#1935CA]/10 text-[#1935CA] dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]">
                  IRT 1-PL
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Item Response Theory calibrates question difficulty dynamically to your ability.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Topic Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Assessment Topic or Domain
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Distributed Consensus, Python Concurrency, GraphQL APIs"
              disabled={isGenerating}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1935CA] dark:focus:ring-[#38BDF8]"
            />

            {/* Suggestions */}
            <div className="pt-1">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mr-2">Suggestions:</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {TOPIC_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setTopic(sug)}
                    disabled={isGenerating}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#EEF2FF] dark:hover:bg-slate-700 hover:text-[#1935CA] dark:hover:text-[#38BDF8] transition"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* CAT Configuration Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Item Pool Size */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-[#1935CA] dark:text-[#38BDF8]" />
                  Item Pool Size
                </span>
                <span className="font-mono text-[#1935CA] dark:text-[#38BDF8]">{itemPoolSize} Items</span>
              </div>
              <p className="text-[11px] text-slate-400">Total stratified questions generated (Easy to Expert).</p>
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[8, 12, 16, 20].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setItemPoolSize(size)}
                    disabled={isGenerating}
                    className={`py-1 rounded-lg text-xs font-bold border transition ${
                      itemPoolSize === size
                        ? 'bg-[#1935CA] text-white border-[#1935CA]'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Test Length */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#1935CA] dark:text-[#38BDF8]" />
                  Test Length
                </span>
                <span className="font-mono text-[#1935CA] dark:text-[#38BDF8]">{maxTestLength} Questions</span>
              </div>
              <p className="text-[11px] text-slate-400">Maximum adaptive steps until ability convergence.</p>
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[4, 6, 8, 10].map((len) => (
                  <button
                    key={len}
                    type="button"
                    onClick={() => setMaxTestLength(len)}
                    disabled={isGenerating}
                    className={`py-1 rounded-lg text-xs font-bold border transition ${
                      maxTestLength === len
                        ? 'bg-[#1935CA] text-white border-[#1935CA]'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {len}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* AI Model Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              AI Calibration Engine
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'gemini', name: 'Google Gemini', desc: 'Fast & Stratified' },
                { id: 'groq', name: 'Groq LLaMA-3', desc: 'Sub-second speed' },
                { id: 'nvidia', name: 'NVIDIA NIM', desc: 'High-precision reasoning' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id as any)}
                  disabled={isGenerating}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    provider === p.id
                      ? 'border-[#1935CA] dark:border-[#38BDF8] bg-[#EEF2FF] dark:bg-slate-800/90 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold">{p.name}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* IRT Information Callout */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8] shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong className="text-slate-900 dark:text-slate-200">How CAT Works:</strong> Each question is selected in real-time to maximize Fisher Information for your current estimated ability (θ). Correct answers escalate question difficulty; incorrect answers lower it.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isGenerating || !topic.trim()}
              className="px-6 py-2.5 rounded-xl bg-[#1935CA] hover:bg-[#142BA3] disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-[#1935CA]/20 transition flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Stratified Item Pool...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Begin Adaptive Test</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
