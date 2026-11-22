import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, ApiError } from '../../api/client';
import { LLMProviderType } from '@quiz-forge/shared';
import {
  Code2,
  Loader2,
  X,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
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
  'https://github.com/fastify/fastify',
  'https://github.com/expressjs/express',
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setIsLoadingProviders(true);
      apiClient
        .get<{ providers: ProviderOption[] }>('/api/llm/providers')
        .then((data) => {
          setProviders(data.providers);
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
    if (isGenerating) return;
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
          : 'Failed to generate code quiz. Verify the repository is public.';
      setError(msg);
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
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-[#1935CA] tracking-tight">
                New GitHub Code Review
              </h3>
              <p className="text-xs text-[#696F79] font-medium">
                Adversarial line-by-line review powered by AI
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
          {/* GitHub Repository URL */}
          <div>
            <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
              GitHub Repository URL*
            </label>
            <input
              type="url"
              required
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="w-full px-4 py-3 rounded-xl bg-[#F8F9FC] text-[#1E293B] placeholder-[#94A3B8] text-sm border border-slate-200/80 focus:ring-2 focus:ring-[#1935CA] focus:bg-white transition outline-none font-medium"
            />

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <span className="text-[11px] font-semibold text-[#696F79]">Presets:</span>
              {REPO_PRESETS.map((preset) => {
                const shortName = preset.replace('https://github.com/', '');
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRepoUrl(preset)}
                    className="px-2 py-0.5 rounded-md bg-[#EEF2FF] hover:bg-[#1935CA] text-[#1935CA] hover:text-white text-[10px] font-mono font-bold transition"
                  >
                    {shortName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* LLM Provider Selection Cards */}
          <div>
            <label className="block text-xs font-bold text-[#1E293B] mb-2">
              Select LLM Reasoning Engine
            </label>
            {isLoadingProviders ? (
              <div className="py-4 text-center text-xs text-slate-400">Loading AI providers...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {providers.map((p) => {
                  const isSelected = llmProvider === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setLlmProvider(p.id as LLMProviderType)}
                      className={`p-3 rounded-xl border text-left transition relative ${
                        isSelected
                          ? 'border-[#1935CA] bg-[#EEF2FF] shadow-sm'
                          : 'border-slate-200/80 bg-[#F8F9FC] hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-bold leading-tight ${
                            isSelected ? 'text-[#1935CA]' : 'text-[#1E293B]'
                          }`}
                        >
                          {p.displayName}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            p.isAvailable ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                      </div>
                      <span className="text-[10px] text-[#696F79] font-mono block">
                        {p.defaultModel.replace('openai/', '').replace('meta/', '')}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Question Count Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#1E293B]">
                Number of Review Questions
              </label>
              <span className="px-2.5 py-0.5 rounded-full bg-[#EEF2FF] text-[#1935CA] font-bold text-xs">
                {questionCount} Questions
              </span>
            </div>
            <input
              type="range"
              min={3}
              max={10}
              step={1}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="w-full accent-[#1935CA] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#94A3B8] font-semibold mt-1">
              <span>3 (Quick Review)</span>
              <span>5 (Standard)</span>
              <span>10 (Deep Audit)</span>
            </div>
          </div>

          {/* Collapsible Advanced Focus */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-bold text-[#1935CA] flex items-center gap-1 hover:underline"
            >
              <span>{showAdvanced ? 'Hide Advanced Focus' : 'Show Advanced Focus (Subfolders & Topics)'}</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvanced && (
              <div className="mt-3 p-4 rounded-xl bg-[#F8F9FC] border border-slate-100 space-y-3 animate-in fade-in">
                <div>
                  <label className="block text-[11px] font-bold text-[#1E293B] mb-1">
                    Specific Subfolder Path (Optional)
                  </label>
                  <input
                    type="text"
                    value={subfolder}
                    onChange={(e) => setSubfolder(e.target.value)}
                    placeholder="e.g. packages/core or src/services"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-[#1E293B] outline-none focus:ring-1 focus:ring-[#1935CA]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#1E293B] mb-1">
                    Focus Concepts (Optional)
                  </label>
                  <input
                    type="text"
                    value={focusAreas}
                    onChange={(e) => setFocusAreas(e.target.value)}
                    placeholder="e.g. error handling, state machine, auth"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-[#1E293B] outline-none focus:ring-1 focus:ring-[#1935CA]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-[#1935CA] hover:bg-[#142BA3] text-white shadow-[0_8px_20px_rgba(25,53,202,0.22)] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 active:scale-98"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Fetching Repo & Analyzing Code Hierarchy...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Code Review</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
