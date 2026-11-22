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
  onQuizCreated?: (quizId: string, topic?: string) => void;
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

export function UrlQuizModal({ isOpen, onClose, onQuizCreated }: UrlQuizModalProps) {
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
        .catch(() => {});
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
              if (onQuizCreated && job.quizId) {
                onQuizCreated(job.quizId, topic.trim() || 'Web Article Assessment');
              } else {
                navigate(`/quiz/${job.attemptId}`);
              }
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
    }, 2500);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isGenerating) return;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 rounded-[24px] shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          disabled={isGenerating}
          className="absolute top-6 right-6 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="p-3 rounded-2xl bg-[#EEF2FF] dark:bg-indigo-950/50 text-[#1935CA] dark:text-indigo-300">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EEF2FF] dark:bg-indigo-950/50 text-[#1935CA] dark:text-indigo-300 text-[11px] font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-3 h-3" />
              <span>Multi-Source Ingestion</span>
            </div>
            <h2 className="text-xl font-extrabold text-[#1E293B] dark:text-[#F8FAFC]">URL / Web Page to Quiz</h2>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <span className="text-xs font-semibold">{error}</span>
          </div>
        )}

        {isGenerating || activeJob ? (
          <div className="py-8 space-y-6 text-center animate-in fade-in duration-300">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              {activeJob?.status === 'completed' ? (
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center animate-bounce">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 rounded-full border-4 border-[#1935CA]/20 animate-pulse" />
                  <Loader2 className="w-10 h-10 text-[#1935CA] dark:text-indigo-400 animate-spin" />
                </>
              )}
            </div>

            <div>
              <h3 className="text-lg font-bold text-[#1E293B] dark:text-[#F8FAFC]">
                {activeJob?.status === 'completed'
                  ? 'Assessment Ready!'
                  : 'Ingesting Web Content...'}
              </h3>
              <p className="text-xs text-[#696F79] dark:text-slate-400 mt-1 max-w-sm mx-auto font-medium">
                {activeJob?.message || 'Validating URL with SSRF protection and extracting article text...'}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-md mx-auto space-y-2">
              <div className="flex justify-between text-xs font-bold text-[#696F79] dark:text-slate-400">
                <span className="capitalize">{activeJob?.stage?.replace('_', ' ') || 'Queued'}</span>
                <span>{activeJob?.progress ?? 5}%</span>
              </div>
              <div className="h-2.5 w-full bg-[#EEF2FF] dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#1935CA] to-[#38BDF8] rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, activeJob?.progress ?? 5)}%` }}
                />
              </div>
            </div>

            {activeJob?.status === 'completed' && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
                Redirecting to assessment room...
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* SSRF Security Badge */}
            <div className="p-3 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 flex items-center gap-2.5 text-xs text-[#696F79] dark:text-slate-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                SSRF-Protected: DNS pre-lookup rejects loopback, RFC1918 subnets, and cloud metadata.
              </span>
            </div>

            {/* URL Input */}
            <div>
              <label htmlFor="article-url" className="block text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC] mb-1.5">
                Public Web Page URL *
              </label>
              <div className="relative">
                <input
                  id="article-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/engineering/microservices-guide"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 focus:ring-2 focus:ring-[#1935CA] focus:bg-white dark:focus:bg-[#151C2C] text-sm text-[#1E293B] dark:text-[#F8FAFC] placeholder-[#94A3B8] transition outline-none font-medium"
                  required
                />
                <ExternalLink className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              </div>

              {/* URL Presets */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[#696F79] dark:text-slate-400 font-semibold">Quick presets:</span>
                {URL_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setUrl(p.url);
                      if (!topic.trim()) setTopic(p.label);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#F8F9FC] dark:bg-[#1E293B] hover:bg-[#EEF2FF] dark:hover:bg-indigo-950/40 text-[#1E293B] dark:text-[#F8FAFC] hover:text-[#1935CA] dark:hover:text-indigo-300 text-[11px] font-medium border border-slate-200/80 dark:border-slate-700 transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Topic Override */}
            <div>
              <label htmlFor="url-topic" className="block text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC] mb-1.5">
                Quiz Title / Topic (Optional)
              </label>
              <input
                id="url-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Defaults to web page title"
                className="w-full px-4 py-3 rounded-xl bg-[#F8F9FC] dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 focus:ring-2 focus:ring-[#1935CA] focus:bg-white dark:focus:bg-[#151C2C] text-sm text-[#1E293B] dark:text-[#F8FAFC] placeholder-[#94A3B8] transition outline-none font-medium"
              />
            </div>

            {/* Question Count Selector */}
            <div>
              <label className="block text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC] mb-1.5">
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
                        ? 'bg-[#1935CA] text-white border-[#1935CA] shadow-sm'
                        : 'bg-[#F8F9FC] dark:bg-[#1E293B] border-slate-200/80 dark:border-slate-700 text-[#696F79] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#1E293B] dark:hover:text-[#F8FAFC]'
                    }`}
                  >
                    {count} Questions
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Selector */}
            <div>
              <label className="block text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC] mb-1.5">
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
                        ? 'bg-[#EEF2FF] dark:bg-indigo-950/40 border-[#1935CA] ring-1 ring-[#1935CA]'
                        : 'bg-[#F8F9FC] dark:bg-[#1E293B] border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className={`block text-xs font-bold ${
                        difficulty === diff.id ? 'text-[#1935CA] dark:text-indigo-400' : 'text-[#1E293B] dark:text-[#F8FAFC]'
                      }`}
                    >
                      {diff.label}
                    </span>
                    <span className="block text-[11px] text-[#696F79] dark:text-slate-400 mt-0.5">{diff.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Provider Selector */}
            {providers.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC] mb-1.5 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[#1935CA] dark:text-indigo-400" />
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
                          ? 'bg-[#EEF2FF] dark:bg-indigo-950/40 border-[#1935CA] ring-2 ring-[#1935CA]'
                          : p.isAvailable
                          ? 'bg-[#F8F9FC] dark:bg-[#1E293B] border-slate-200/80 dark:border-slate-700 text-[#1E293B] dark:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-slate-800'
                          : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <span className={`block text-xs font-bold truncate ${provider === p.id ? 'text-[#1935CA] dark:text-indigo-400' : 'text-[#1E293B] dark:text-[#F8FAFC]'}`}>
                        {p.displayName}
                      </span>
                      <span className="block text-[10px] text-[#696F79] dark:text-slate-400">
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
              className="w-full py-3.5 rounded-xl bg-[#1935CA] hover:bg-[#142BA3] disabled:opacity-50 text-white font-bold text-sm shadow-xl shadow-[#1935CA]/20 transition flex items-center justify-center gap-2"
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
