import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, ApiError } from '../../api/client';
import { QuizDifficulty, JobResult } from '@quiz-forge/shared';
import {
  FileUp,
  FileText,
  Sparkles,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
  Cpu,
  ArrowRight,
} from 'lucide-react';

interface ProviderOption {
  id: string;
  name: string;
  displayName: string;
  isAvailable: boolean;
}

interface PdfQuizModalProps {
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

export function PdfQuizModal({ isOpen, onClose }: PdfQuizModalProps) {
  const [file, setFile] = useState<File | null>(null);
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
          const firstAvail = data.providers.find((p) => p.isAvailable);
          if (firstAvail) {
            setProvider(firstAvail.id);
          }
        })
        .catch(() => {
          // ignore provider fetch failure
        });
    }

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileSelect = (selectedFile: File) => {
    setError(null);
    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF documents (.pdf) are supported.');
      return;
    }
    if (selectedFile.size > 15 * 1024 * 1024) {
      setError('File size exceeds the 15 MB limit.');
      return;
    }
    setFile(selectedFile);
    if (!topic.trim()) {
      setTopic(selectedFile.name.replace(/\.pdf$/i, ''));
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
          setError(job.error || 'Job processing failed.');
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
      setError('Please upload a PDF document.');
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
        '/api/quizzes/generate/pdf',
        formData
      );

      pollJobStatus(res.jobId);
    } catch (err: unknown) {
      setIsUploading(false);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to initiate PDF quiz generation.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          disabled={isUploading}
          className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-3 h-3" />
              <span>Multi-Source Ingestion</span>
            </div>
            <h2 className="text-xl font-bold text-white">PDF Document to Quiz</h2>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {isUploading || activeJob ? (
          /* Live Job Tracking Stepper */
          <div className="py-8 space-y-6 text-center animate-in fade-in duration-300">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              {activeJob?.status === 'completed' ? (
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center animate-bounce">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 rounded-full border-4 border-rose-500/20 animate-pulse" />
                  <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
                </>
              )}
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">
                {activeJob?.status === 'completed'
                  ? 'Assessment Ready!'
                  : 'Processing PDF Document...'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {activeJob?.message || 'Extracting text and synthesizing grounded questions...'}
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
                  className="h-full bg-gradient-to-r from-rose-500 via-pink-500 to-indigo-500 rounded-full transition-all duration-500"
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
          /* Configuration & File Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Dropzone */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Document Upload (Max 15 MB)
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
                    ? 'border-rose-500 bg-rose-500/10'
                    : file
                    ? 'border-rose-500/50 bg-rose-500/5'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                {file ? (
                  <div className="flex items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-3 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{file.name}</p>
                        <p className="text-xs text-slate-400">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB • PDF Verified
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
                      <FileUp className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      Click to browse or drop your PDF here
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Lecture slides, research articles, book chapters, syllabi
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Topic Override */}
            <div>
              <label htmlFor="pdf-topic" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Quiz Title / Topic Name
              </label>
              <input
                id="pdf-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Distributed Consensus in Raft"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-sm text-white placeholder-slate-600 transition outline-none"
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
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
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
                        ? 'bg-rose-500/10 border-rose-500'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span
                      className={`block text-xs font-bold ${
                        difficulty === diff.id ? 'text-rose-300' : 'text-slate-300'
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
                  <Cpu className="w-3.5 h-3.5 text-rose-400" />
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
                          ? 'bg-rose-500/20 border-rose-500 text-rose-300'
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
              disabled={!file}
              className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:hover:bg-rose-600 text-white font-bold text-sm shadow-xl shadow-rose-600/20 transition flex items-center justify-center gap-2"
            >
              <span>Generate Assessment from PDF</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
