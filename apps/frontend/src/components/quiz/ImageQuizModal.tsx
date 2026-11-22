import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, ApiError } from '../../api/client';
import { QuizDifficulty, JobResult } from '@quiz-forge/shared';
import {
  Image,
  Sparkles,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
  Cpu,
  ArrowRight,
  Eye,
} from 'lucide-react';

interface ProviderOption {
  id: string;
  name: string;
  displayName: string;
  isAvailable: boolean;
}

interface ImageQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COUNT_PRESETS = [3, 5, 10, 15];

const DIFFICULTIES: Array<{ id: QuizDifficulty; label: string; desc: string }> = [
  { id: 'easy', label: 'Easy', desc: 'Core fundamentals & definitions' },
  { id: 'medium', label: 'Medium', desc: 'Conceptual application' },
  { id: 'hard', label: 'Hard', desc: 'Edge cases & deep mechanics' },
  { id: 'mixed', label: 'Mixed', desc: 'Balanced variety across tiers' },
];

export function ImageQuizModal({ isOpen, onClose }: ImageQuizModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('mixed');
  const [provider, setProvider] = useState<string>('');
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeJob, setActiveJob] = useState<JobResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      apiClient
        .get<{ providers: ProviderOption[] }>('/api/llm/providers')
        .then((data) => {
          setProviders(data.providers);
          const gemini = data.providers.find((p) => p.id === 'gemini' && p.isAvailable);
          if (gemini) {
            setProvider(gemini.id);
          } else {
            const firstAvail = data.providers.find((p) => p.isAvailable);
            if (firstAvail) setProvider(firstAvail.id);
          }
        })
        .catch(() => {});
    }

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileSelect = (selectedFile: File) => {
    setError(null);
    const validExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    const hasValidExt = validExtensions.some((ext) =>
      selectedFile.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExt) {
      setError('Only PNG, JPEG, and WebP images are supported.');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('Image file size exceeds the 10 MB limit.');
      return;
    }

    setFile(selectedFile);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(selectedFile));

    if (!topic.trim()) {
      const cleanName = selectedFile.name
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]/g, ' ');
      setTopic(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const pollJobStatus = (jobId: string) => {
    pollingTimerRef.current = setInterval(async () => {
      try {
        const job = await apiClient.get<JobResult>(`/api/jobs/${jobId}`);
        setActiveJob(job);

        if (job.status === 'completed') {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          setIsUploading(false);
          if (job.attemptId) {
            setTimeout(() => {
              onClose();
              navigate(`/quiz/${job.attemptId}`);
            }, 800);
          }
        } else if (job.status === 'failed') {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          setIsUploading(false);
          setError(job.error || 'Vision analysis failed.');
        }
      } catch (err: unknown) {
        if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
        setIsUploading(false);
        setError(err instanceof Error ? err.message : 'Failed to query job status.');
      }
    }, 1000);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError('Please select an image file to analyze.');
      return;
    }

    setIsUploading(true);
    setActiveJob(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (topic.trim()) formData.append('topic', topic.trim());
      formData.append('questionCount', String(questionCount));
      formData.append('difficulty', difficulty);
      if (provider) formData.append('provider', provider);

      const res = await apiClient.postFormData<{ jobId: string; status: string }>(
        '/api/quizzes/generate/image',
        formData
      );

      pollJobStatus(res.jobId);
    } catch (err: unknown) {
      setIsUploading(false);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to initiate image quiz generation.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white border border-slate-100 rounded-[24px] shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          disabled={isUploading}
          className="absolute top-6 right-6 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="p-3 rounded-2xl bg-[#EEF2FF] text-[#1935CA]">
            <Image className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EEF2FF] text-[#1935CA] text-[11px] font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-3 h-3" />
              <span>Vision & Multimodal</span>
            </div>
            <h2 className="text-xl font-extrabold text-[#1E293B]">Image to Quiz (Vision AI)</h2>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <span className="text-xs font-semibold">{error}</span>
          </div>
        )}

        {isUploading || activeJob ? (
          <div className="py-8 space-y-6 text-center animate-in fade-in duration-300">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              {activeJob?.status === 'completed' ? (
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center animate-bounce">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 rounded-full border-4 border-[#1935CA]/20 animate-pulse" />
                  <Loader2 className="w-10 h-10 text-[#1935CA] animate-spin" />
                </>
              )}
            </div>

            <div>
              <h3 className="text-lg font-bold text-[#1E293B]">
                {activeJob?.status === 'completed'
                  ? 'Assessment Ready!'
                  : 'Analyzing Visual Document...'}
              </h3>
              <p className="text-xs text-[#696F79] mt-1 max-w-sm mx-auto font-medium">
                {activeJob?.message || 'Processing image features and synthesizing grounded questions...'}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-md mx-auto space-y-2">
              <div className="flex justify-between text-xs font-bold text-[#696F79]">
                <span className="capitalize">{activeJob?.stage?.replace('_', ' ') || 'Queued'}</span>
                <span>{activeJob?.progress ?? 5}%</span>
              </div>
              <div className="h-2.5 w-full bg-[#EEF2FF] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#1935CA] to-[#38BDF8] rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, activeJob?.progress ?? 5)}%` }}
                />
              </div>
            </div>

            {activeJob?.status === 'completed' && (
              <p className="text-xs text-emerald-600 font-bold animate-pulse">
                Redirecting to assessment room...
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* File Dropzone */}
            <div>
              <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
                Educational Image (Max 10 MB) *
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-[#1935CA] bg-[#EEF2FF]/60'
                    : file
                    ? 'border-[#1935CA]/60 bg-[#EEF2FF]/30'
                    : 'border-slate-200 hover:border-[#1935CA]/50 bg-[#F8F9FC]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                {file && previewUrl ? (
                  <div className="flex items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 shadow-sm"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1E293B] truncate">{file.name}</p>
                        <p className="text-xs text-[#696F79]">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB • Verified Image
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setPreviewUrl(null);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] text-[#1935CA] flex items-center justify-center mx-auto mb-3">
                      <Eye className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-[#1E293B]">
                      Drop diagrams, handwritten notes, whiteboards, or slides
                    </p>
                    <p className="text-xs text-[#696F79] mt-1 font-medium">
                      PNG, JPEG, WebP supported up to 10 MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Topic Override */}
            <div>
              <label htmlFor="image-topic" className="block text-xs font-bold text-[#1E293B] mb-1.5">
                Assessment Title / Topic (Optional)
              </label>
              <input
                id="image-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. System Architecture Diagram"
                className="w-full px-4 py-3 rounded-xl bg-[#F8F9FC] border border-slate-200/80 focus:ring-2 focus:ring-[#1935CA] focus:bg-white text-sm text-[#1E293B] placeholder-[#94A3B8] transition outline-none font-medium"
              />
            </div>

            {/* Question Count Selector */}
            <div>
              <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
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
                        : 'bg-[#F8F9FC] border-slate-200/80 text-[#696F79] hover:bg-slate-100 hover:text-[#1E293B]'
                    }`}
                  >
                    {count} Questions
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Selector */}
            <div>
              <label className="block text-xs font-bold text-[#1E293B] mb-1.5">
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
                        ? 'bg-[#EEF2FF] border-[#1935CA] ring-1 ring-[#1935CA]'
                        : 'bg-[#F8F9FC] border-slate-200/80 hover:bg-slate-100'
                    }`}
                  >
                    <span
                      className={`block text-xs font-bold ${
                        difficulty === diff.id ? 'text-[#1935CA]' : 'text-[#1E293B]'
                      }`}
                    >
                      {diff.label}
                    </span>
                    <span className="block text-[11px] text-[#696F79] mt-0.5">{diff.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Provider Selector */}
            {providers.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-[#1E293B] mb-1.5 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[#1935CA]" />
                  <span>Multimodal Vision Engine</span>
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
                          ? 'bg-[#EEF2FF] border-[#1935CA] ring-2 ring-[#1935CA]'
                          : p.isAvailable
                          ? 'bg-[#F8F9FC] border-slate-200/80 text-[#1E293B] hover:bg-slate-100'
                          : 'bg-slate-100 border-slate-200 text-slate-400 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <span className={`block text-xs font-bold truncate ${provider === p.id ? 'text-[#1935CA]' : 'text-[#1E293B]'}`}>
                        {p.displayName}
                      </span>
                      <span className="block text-[10px] text-[#696F79]">
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
              disabled={!file}
              className="w-full py-3.5 rounded-xl bg-[#1935CA] hover:bg-[#142BA3] disabled:opacity-50 text-white font-bold text-sm shadow-xl shadow-[#1935CA]/20 transition flex items-center justify-center gap-2"
            >
              <span>Analyze Image & Generate Assessment</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
