import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, ApiError } from '../../api/client';
import { LLMProviderType } from '@quiz-forge/shared';
import {
  Code2,
  GitBranch,
  Cpu,
  Loader2,
  X,
  AlertCircle,
  FolderGit2,
  Sparkles,
} from 'lucide-react';

interface ProviderOption {
  id: string;
  name: string;
  displayName: string;
  defaultModel: string;
  isAvailable: boolean;
  description: string;
}

interface CodeQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const REPO_PRESETS = [
  'https://github.com/expressjs/express',
  'https://github.com/fastify/fastify',
  'https://github.com/colinhacks/zod',
  'https://github.com/facebook/react',
];

export function CodeQuizModal({ isOpen, onClose }: CodeQuizModalProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [subfolder, setSubfolder] = useState('');
  const [focusAreas, setFocusAreas] = useState('');
  const [llmProvider, setLlmProvider] = useState<LLMProviderType>('groq');
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setIsLoadingProviders(true);
      apiClient
        .get<{ providers: ProviderOption[] }>('/api/llm/providers')
        .then((data) => {
          setProviders(data.providers);
          // Auto-select first available provider
          const firstAvail = data.providers.find((p) => p.isAvailable);
          if (firstAvail) {
            setLlmProvider(firstAvail.id as LLMProviderType);
          }
        })
        .catch(() => {
          // Keep defaults
        })
        .finally(() => {
          setIsLoadingProviders(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!repoUrl.trim()) {
      setError('Please provide a valid GitHub repository URL.');
      return;
    }

    setIsGenerating(true);
    try {
      const data = await apiClient.post<{
        codeQuizId: string;
        attemptId: string;
        totalQuestions: number;
        status: string;
      }>('/api/code-quizzes/generate', {
        repoUrl: repoUrl.trim(),
        questionCount,
        subfolder: subfolder.trim() || undefined,
        focusAreas: focusAreas.trim() || undefined,
        llmProvider,
      });

      // Save to localStorage for recovery resilience
      try {
        localStorage.setItem(
          'quizforge_last_active_code_attempt',
          JSON.stringify({
            attemptId: data.attemptId,
            repoUrl: repoUrl.trim(),
            totalQuestions: data.totalQuestions,
            updatedAt: Date.now(),
          })
        );
      } catch {
        // safe
      }

      onClose();
      navigate(`/code-quiz/${data.attemptId}`);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Failed to generate code quiz. Verify the repository is public and accessible.';
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          disabled={isGenerating}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Code2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              GitHub Code Review Quiz
            </h2>
            <p className="text-xs text-slate-400">
              Adversarial code-comprehension questions evaluated by LLMs
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-3 text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* GitHub URL */}
          <div>
            <label
              htmlFor="repoUrl"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
            >
              Public GitHub Repository URL
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <FolderGit2 className="w-4 h-4" />
              </div>
              <input
                id="repoUrl"
                type="url"
                required
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repository"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
              />
            </div>
            {/* Quick Presets */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
              <span className="text-slate-500">Try popular repos:</span>
              {REPO_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRepoUrl(preset)}
                  className="px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition text-[11px]"
                >
                  {preset.replace('https://github.com/', '')}
                </button>
              ))}
            </div>
          </div>

          {/* LLM Provider Dropdown */}
          <div>
            <label
              htmlFor="llmProvider"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
            >
              AI Evaluation Provider
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Cpu className="w-4 h-4" />
              </div>
              <select
                id="llmProvider"
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value as LLMProviderType)}
                disabled={isLoadingProviders}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition appearance-none cursor-pointer"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName} {p.isAvailable ? '✓ (Ready)' : '(Key Not Configured)'}
                  </option>
                ))}
              </select>
            </div>
            {providers.find((p) => p.id === llmProvider)?.description && (
              <p className="mt-1.5 text-[11px] text-slate-400">
                {providers.find((p) => p.id === llmProvider)?.description}
              </p>
            )}
          </div>

          {/* Question Count & Subfolder */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="questionCount"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
              >
                Questions: <span className="text-amber-400 font-bold">{questionCount}</span>
              </label>
              <input
                id="questionCount"
                type="range"
                min={3}
                max={15}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                <span>3 questions</span>
                <span>15 questions</span>
              </div>
            </div>

            <div>
              <label
                htmlFor="subfolder"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
              >
                Subfolder Path <span className="text-slate-500">(Optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <GitBranch className="w-3.5 h-3.5" />
                </div>
                <input
                  id="subfolder"
                  type="text"
                  value={subfolder}
                  onChange={(e) => setSubfolder(e.target.value)}
                  placeholder="e.g. src/services"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                />
              </div>
            </div>
          </div>

          {/* Focus Areas */}
          <div>
            <label
              htmlFor="focusAreas"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
            >
              Focus Areas <span className="text-slate-500">(Optional)</span>
            </label>
            <input
              id="focusAreas"
              type="text"
              value={focusAreas}
              onChange={(e) => setFocusAreas(e.target.value)}
              placeholder="e.g. error handling, comment intent, concurrency, data structures"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isGenerating}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 mt-6"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Analyzing repository & generating review questions...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>Start Code Review Quiz</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
