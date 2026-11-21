import { useState, useEffect, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, ApiError } from '../../api/client';
import { QuizDifficulty, JobResult } from '@quiz-forge/shared';
import {
  Globe,
  Sparkles,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
  Cpu,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

interface ProviderOption {
  id: string;
  name: string;
  displayName: string;
  isAvailable: boolean;
}

interface UrlQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COUNT_PRESETS = [3, 5, 10, 15];

const URL_PRESETS = [
  { label: 'Distributed Computing', url: 'https://en.wikipedia.org/wiki/Distributed_computing' },
  { label: 'Raft Consensus', url: 'https://en.wikipedia.org/wiki/Raft_(algorithm)' },
  { label: 'CAP Theorem', url: 'https://en.wikipedia.org/wiki/CAP_theorem' },
  { label: 'Domain-Driven Design', url: 'https://en.wikipedia.org/wiki/Domain-driven_design' },
];

const DIFFICULTIES: Array<{ id: QuizDifficulty; label: string; desc: string }> = [
  { id: 'easy', label: 'Easy', desc: 'Core fundamentals & definitions' },
  { id: 'medium', label: 'Medium', desc: 'Conceptual application' },
  { id: 'hard', label: 'Hard', desc: 'Edge cases & deep mechanics' },
  { id: 'mixed', label: 'Mixed', desc: 'Balanced variety across tiers' },
];

export function UrlQuizModal({ isOpen, onClose }: UrlQuizModalProps) {
  const [url, setUrl] = useState('');
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('mixed');
  const [provider, setProvider] = useState<string>('');
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeJob, setActiveJob] = useState<JobResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
        .catch(() => {
          // ignore
        });
    }

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const pollJobStatus = (jobId: string) => {
    pollingTimerRef.current = setInterval(async () => {
      try {
        const job = await apiClient.get<JobResult>(`/api/jobs/${jobId}`);
        setActiveJob(job);

        if (job.status === 'completed') {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          setIsGenerating(false);
          if (job.attemptId) {
            setTimeout(() => {
              onClose();
              navigate(`/quiz/${job.attemptId}`);
            }, 800);
          }
        } else if (job.status === 'failed') {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          setIsGenerating(false);
          setError(job.error || 'Job processing failed.');
        }
      } catch (err: unknown) {
        if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
        setIsGenerating(false);
        setError(err instanceof Error ? err.message : 'Failed to query job status.');
      }
    }, 1000);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Please provide a web page URL.');
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      setError('Invalid URL format. Please include http:// or https://');
      return;
    }

    setIsGenerating(true);
    setActiveJob(null);

    try {
      const res = await apiClient.post<{ jobId: string; status: string }>(
        '/api/quizzes/generate/url',
        {
          url: trimmedUrl,
          topic: topic.trim() || undefined,
          questionCount,
          difficulty,
          provider: provider || undefined,
        }
      );

      pollJobStatus(res.jobId);
    } catch (err: unknown) {
      setIsGenerating(false);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to initiate URL quiz generation.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          disabled={isGenerating}
          className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-[11px] font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-3 h-3" />
              <span>Multi-Source Ingestion</span>
            </div>
            <h2 className="text-xl font-bold text-white">URL / Web Page to Quiz</h2>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {isGenerating || activeJob ? (
          /* Live Job Tracking Stepper */
          <div className="py-8 space-y-6 text-center animate-in fade-in duration-300">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              {activeJob?.status === 'completed' ? (
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center animate-bounce">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 rounded-full border-4 border-teal-500/20 animate-pulse" />
                  <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
                </>
              )}
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">
                {activeJob?.status === 'completed'
                  ? 'Assessment Ready!'
                  : 'Ingesting Web Content...'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {activeJob?.message || 'Validating URL with SSRF protection and extracting article text...'}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-md mx-auto space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-400">
                <span className="capitalize">{activeJob?.stage?.replace('_', ' ') || 'Queued'}</span>
                <span>{activeJob?.progress ?? 5}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 via-emerald-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, activeJob?.progress ?? 5)}%` }}
                />
              </div>
            </div>

            {activeJob?.status === 'completed' && (
              <p className="text-xs text-emerald-400 font-semibold animate-pulse">
                Redirecting to assessment room...
              </p>
            )}
          </div>
        ) : (
          /* Input Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* SSRF Security Badge */}
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-2.5 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                SSRF-Protected: DNS pre-lookup rejects loopback, RFC1918 subnets, and cloud metadata.
              </span>
            </div>

            {/* URL Input */}
            <div>
              <label htmlFor="article-url" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Public Web Page URL
              </label>
              <div className="relative">
                <input
                  id="article-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/engineering/microservices-guide"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-sm text-white placeholder-slate-600 transition outline-none"
                  required
                />
                <ExternalLink className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
              </div>

              {/* URL Presets */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500 font-medium">Quick presets:</span>
                {URL_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setUrl(p.url);
                      if (!topic.trim()) setTopic(p.label);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Topic Override */}
            <div>
              <label htmlFor="url-topic" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Quiz Title / Topic (Optional)
              </label>
              <input
                id="url-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Defaults to web page title"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-sm text-white placeholder-slate-600 transition outline-none"
              />
            </div>

            {/* Question Count Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Number of Questions
              </label>
              <div className="grid grid-cols-4 gap-2">
                {COUNT_PRESETS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setQuestionCount(count)}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      questionCount === count
                        ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {count} Questions
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Difficulty
              </label>
              <div className="grid grid-cols-2 gap-2">
                {DIFFICULTIES.map((diff) => (
                  <button
                    key={diff.id}
                    type="button"
                    onClick={() => setDifficulty(diff.id)}
                    className={`p-3 text-left rounded-xl border transition ${
                      difficulty === diff.id
                        ? 'bg-teal-500/10 border-teal-500'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span
                      className={`block text-xs font-bold ${
                        difficulty === diff.id ? 'text-teal-300' : 'text-slate-300'
                      }`}
                    >
                      {diff.label}
                    </span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">{diff.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Provider Selector */}
            {providers.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-teal-400" />
                  <span>Synthesizing AI Engine</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!p.isAvailable}
                      onClick={() => setProvider(p.id)}
                      className={`p-2.5 text-left rounded-xl border transition ${
                        provider === p.id
                          ? 'bg-teal-500/20 border-teal-500 text-teal-300'
                          : p.isAvailable
                          ? 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                          : 'bg-slate-950/40 border-slate-800/40 text-slate-600 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <span className="block text-xs font-bold truncate">{p.displayName}</span>
                      <span className="block text-[10px] text-slate-500">
                        {p.isAvailable ? 'Ready' : 'Not configured'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!url.trim()}
              className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:hover:bg-teal-600 text-white font-bold text-sm shadow-xl shadow-teal-600/20 transition flex items-center justify-center gap-2"
            >
              <span>Ingest URL & Generate Assessment</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
