import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';
import { GenerateQuizModal } from '../components/quiz/GenerateQuizModal';
import { PdfQuizModal } from '../components/quiz/PdfQuizModal';
import { UrlQuizModal } from '../components/quiz/UrlQuizModal';
import { ImageQuizModal } from '../components/quiz/ImageQuizModal';
import { CodeQuizModal } from '../components/code-quiz/CodeQuizModal';
import { apiClient } from '../api/client';
import {
  Sparkles,
  Brain,
  History,
  ArrowRight,
  Code2,
  FileText,
  Globe,
  Image as ImageIcon,
  Trophy,
  Target,
  Zap,
  Award,
  Play,
  RotateCcw,
} from 'lucide-react';

interface ActiveDraft {
  attemptId: string;
  topic: string;
  totalQuestions: number;
  updatedAt: number;
}

interface ActiveCodeDraft {
  attemptId: string;
  repoUrl: string;
  totalQuestions: number;
  updatedAt: number;
}

interface ProviderStatus {
  id: string;
  name: string;
  displayName: string;
  defaultModel: string;
  isAvailable: boolean;
  description: string;
}

export function DashboardPage() {
  const { user } = useAuth();

  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);

  const [activeDraft, setActiveDraft] = useState<ActiveDraft | null>(null);
  const [activeCodeDraft, setActiveCodeDraft] = useState<ActiveCodeDraft | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('quizforge_last_active_attempt');
      if (raw) {
        setActiveDraft(JSON.parse(raw));
      }
      const rawCode = localStorage.getItem('quizforge_last_active_code_attempt');
      if (rawCode) {
        setActiveCodeDraft(JSON.parse(rawCode));
      }
    } catch {
      // safe
    }

    // Fetch active LLM providers
    apiClient
      .get<{ providers: ProviderStatus[] }>('/api/llm/providers')
      .then((res) => {
        setProviders(res.providers || []);
      })
      .catch(() => {
        // Fallback default list
        setProviders([
          { id: 'groq', name: 'groq', displayName: 'Groq (GPT-OSS-120B)', defaultModel: 'openai/gpt-oss-120b', isAvailable: true, description: 'Ultra-low latency' },
          { id: 'gemini', name: 'gemini', displayName: 'Google Gemini', defaultModel: 'gemini-2.5-flash', isAvailable: true, description: 'Multimodal vision & reasoning' },
          { id: 'nvidia', name: 'nvidia', displayName: 'NVIDIA NIM', defaultModel: 'meta/llama-3.3-70b-instruct', isAvailable: false, description: 'High-throughput enterprise' },
        ]);
      });
  }, []);

  const handleDiscardDraft = () => {
    if (activeDraft) {
      try {
        localStorage.removeItem(`quizforge_attempt_${activeDraft.attemptId}`);
        localStorage.removeItem('quizforge_last_active_attempt');
      } catch {
        // safe
      }
      setActiveDraft(null);
    }
  };

  const handleDiscardCodeDraft = () => {
    if (activeCodeDraft) {
      try {
        localStorage.removeItem(`quizforge_code_attempt_${activeCodeDraft.attemptId}`);
        localStorage.removeItem(`quizforge_code_answers_${activeCodeDraft.attemptId}`);
        localStorage.removeItem('quizforge_last_active_code_attempt');
      } catch {
        // safe
      }
      setActiveCodeDraft(null);
    }
  };

  const userInitials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'QF';

  return (
    <AppLayout activeNav="dashboard">
      <div className="flex flex-col xl:flex-row gap-6">
        {/* ===================== CENTER MAIN REGION ===================== */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* User Profile & Progress Hero Card (Dashboard.png Reference) */}
          <div className="bg-white rounded-[20px] p-6 sm:p-7 shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100/80">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#1935CA] to-[#38BDF8] flex items-center justify-center text-white text-2xl font-black shadow-md">
                  {userInitials}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-[#1935CA] tracking-tight">
                      {user?.displayName || 'Developer'}
                    </h1>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#EEF2FF] text-[#1935CA] font-bold text-[11px] uppercase tracking-wider">
                      {user?.role === 'teacher' ? 'Instructor' : 'Level 12'}
                    </span>
                  </div>
                  <p className="text-xs text-[#696F79] font-medium mt-1">
                    Code Review Mastery • 72% Completed
                  </p>
                </div>
              </div>

              {/* Start Quiz Action */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsCodeModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-[#EEF2FF] hover:bg-[#1935CA]/10 text-[#1935CA] font-bold text-xs transition flex items-center gap-1.5"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Review Repo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsGenerateModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-[#1935CA] hover:bg-[#142BA3] text-white font-bold text-xs shadow-[0_8px_20px_rgba(25,53,202,0.22)] transition flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Start Quiz</span>
                </button>
              </div>
            </div>

            {/* Horizontal Mastery Progress Bar */}
            <div className="w-full bg-[#F1F5F9] rounded-full h-2.5 overflow-hidden mb-6">
              <div
                className="bg-[#1935CA] h-2.5 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: '72%' }}
              />
            </div>

            {/* 3 Square-Icon Stat Tiles (Dashboard.png Reference) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-[#F8F9FC] flex items-center gap-3.5 border border-slate-100/60">
                <div className="w-12 h-12 rounded-xl bg-white shadow-[0_4px_16px_rgba(15,23,42,0.05)] flex items-center justify-center text-[#1935CA] shrink-0">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <span className="block text-xl font-extrabold text-[#1E293B] leading-tight">
                    24
                  </span>
                  <span className="block text-xs font-semibold text-[#696F79]">
                    Quizzes Passed
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#F8F9FC] flex items-center gap-3.5 border border-slate-100/60">
                <div className="w-12 h-12 rounded-xl bg-white shadow-[0_4px_16px_rgba(15,23,42,0.05)] flex items-center justify-center text-[#1935CA] shrink-0">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <span className="block text-xl font-extrabold text-[#1E293B] leading-tight">
                    8.8 / 10
                  </span>
                  <span className="block text-xs font-semibold text-[#696F79]">
                    Avg Rubric Score
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#F8F9FC] flex items-center gap-3.5 border border-slate-100/60">
                <div className="w-12 h-12 rounded-xl bg-white shadow-[0_4px_16px_rgba(15,23,42,0.05)] flex items-center justify-center text-[#1935CA] shrink-0">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <span className="block text-xl font-extrabold text-[#1E293B] leading-tight">
                    142
                  </span>
                  <span className="block text-xs font-semibold text-[#696F79]">
                    Questions Graded
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Conditional In-Progress Code Review Recovery Banner */}
          {activeCodeDraft && (
            <div className="p-5 rounded-[20px] bg-[#EEF2FF] border border-[#1935CA]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#1935CA] text-white flex items-center justify-center shrink-0 shadow-md">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#1935CA]">
                      Active Code Review Session
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <h4 className="text-sm font-bold text-[#1E293B] mt-0.5">
                    {activeCodeDraft.repoUrl.replace('https://github.com/', '')} ({activeCodeDraft.totalQuestions} Questions)
                  </h4>
                  <p className="text-xs text-[#696F79]">
                    Your code answers are cached safely in local storage.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={handleDiscardCodeDraft}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#696F79] hover:text-rose-600 transition"
                >
                  Discard
                </button>
                <Link
                  to={`/code-quiz/${activeCodeDraft.attemptId}`}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1935CA] hover:bg-[#142BA3] text-white shadow-md transition flex items-center gap-1.5"
                >
                  <span>Resume Review</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* Conditional In-Progress MCQ Recovery Banner */}
          {activeDraft && (
            <div className="p-5 rounded-[20px] bg-white border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_10px_30px_rgba(25,53,202,0.05)] animate-in fade-in">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                    Unsaved MCQ Quiz
                  </span>
                  <h4 className="text-sm font-bold text-[#1E293B] mt-0.5">
                    {activeDraft.topic} ({activeDraft.totalQuestions} Questions)
                  </h4>
                  <p className="text-xs text-[#696F79]">
                    Preserved locally — resume without re-calling AI.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#696F79] hover:text-rose-600 transition"
                >
                  Discard
                </button>
                <Link
                  to={`/quiz/${activeDraft.attemptId}`}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1935CA] hover:bg-[#142BA3] text-white shadow-md transition flex items-center gap-1.5"
                >
                  <span>Resume Quiz</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* ===================== 3-CARD ASSESSMENT GRID (Dashboard.png Reference) ===================== */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold text-[#1935CA] tracking-tight">
                Featured Assessments
              </h2>
              <span className="text-xs text-[#696F79] font-medium">
                Choose an assessment mode to begin
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: GitHub Code Review */}
              <div
                onClick={() => setIsCodeModalOpen(true)}
                className="group relative h-64 rounded-[20px] overflow-hidden cursor-pointer shadow-[0_10px_30px_rgba(25,53,202,0.06)] hover:shadow-[0_16px_36px_rgba(25,53,202,0.12)] transition-all hover:-translate-y-1 bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#1935CA] p-5 flex flex-col justify-between"
              >
                {/* Top-left pill badge */}
                <div className="flex items-center justify-between z-10">
                  <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-[#1935CA] text-xs font-bold shadow-sm">
                    Multi-LLM AI
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 group-hover:scale-110 transition-transform">
                    <Code2 className="w-4 h-4" />
                  </div>
                </div>

                {/* Decorative background visual */}
                <div className="absolute inset-0 opacity-20 font-mono text-[10px] text-cyan-300 p-4 pointer-events-none select-none overflow-hidden">
                  <code>{`async function reviewRepo(url) {\n  const tree = await github.getTree(url);\n  return ai.adversarialEval(tree);\n}`}</code>
                </div>

                {/* Frosted Bottom Title Overlay */}
                <div className="relative z-10 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-md flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm text-[#1E293B] group-hover:text-[#1935CA] transition-colors">
                      GitHub Code Review
                    </h3>
                    <p className="text-[11px] text-[#696F79] font-medium mt-0.5">
                      Adversarial line-by-line review
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-[#1935CA] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Card 2: Topic MCQ Quiz */}
              <div
                onClick={() => setIsGenerateModalOpen(true)}
                className="group relative h-64 rounded-[20px] overflow-hidden cursor-pointer shadow-[0_10px_30px_rgba(25,53,202,0.06)] hover:shadow-[0_16px_36px_rgba(25,53,202,0.12)] transition-all hover:-translate-y-1 bg-gradient-to-br from-[#1935CA] via-[#2546F0] to-[#38BDF8] p-5 flex flex-col justify-between"
              >
                {/* Top-left pill badge */}
                <div className="flex items-center justify-between z-10">
                  <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-[#1935CA] text-xs font-bold shadow-sm">
                    Timed MCQ
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    <Sparkles className="w-4 h-4" />
                  </div>
                </div>

                {/* Decorative background visual */}
                <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none select-none">
                  <Brain className="w-32 h-32 text-white" />
                </div>

                {/* Frosted Bottom Title Overlay */}
                <div className="relative z-10 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-md flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm text-[#1E293B] group-hover:text-[#1935CA] transition-colors">
                      Topic MCQ Quiz
                    </h3>
                    <p className="text-[11px] text-[#696F79] font-medium mt-0.5">
                      Personalized AI questions & scoring
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-[#1935CA] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Card 3: Quiz History */}
              <Link
                to="/history"
                className="group relative h-64 rounded-[20px] overflow-hidden cursor-pointer shadow-[0_10px_30px_rgba(25,53,202,0.06)] hover:shadow-[0_16px_36px_rgba(25,53,202,0.12)] transition-all hover:-translate-y-1 bg-gradient-to-br from-indigo-900 via-indigo-700 to-[#1935CA] p-5 flex flex-col justify-between"
              >
                {/* Top-left pill badge */}
                <div className="flex items-center justify-between z-10">
                  <span className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-[#1935CA] text-xs font-bold shadow-sm">
                    Review & Retake
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    <History className="w-4 h-4" />
                  </div>
                </div>

                {/* Decorative background visual */}
                <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none select-none">
                  <RotateCcw className="w-32 h-32 text-white" />
                </div>

                {/* Frosted Bottom Title Overlay */}
                <div className="relative z-10 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-md flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm text-[#1E293B] group-hover:text-[#1935CA] transition-colors">
                      Quiz History & Archive
                    </h3>
                    <p className="text-[11px] text-[#696F79] font-medium mt-0.5">
                      Zero-AI retakes & performance logs
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-[#1935CA] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* Multi-Modal Ingestion Quick Strip */}
          <div className="bg-white rounded-[20px] p-5 shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100/80">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider">
                Multi-Modal Ingestion Engines
              </h3>
              <span className="text-[11px] font-semibold text-[#1935CA]">
                Async Queue Supported
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(true)}
                className="flex items-center gap-3 p-3 rounded-xl bg-[#F8F9FC] hover:bg-[#EEF2FF] border border-slate-100 hover:border-[#1935CA]/30 text-left transition group"
              >
                <div className="w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center text-rose-600 group-hover:scale-105 transition">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#1E293B] group-hover:text-[#1935CA] transition">
                    PDF Document
                  </h4>
                  <p className="text-[10px] text-[#696F79]">Notes & Slides</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsUrlModalOpen(true)}
                className="flex items-center gap-3 p-3 rounded-xl bg-[#F8F9FC] hover:bg-[#EEF2FF] border border-slate-100 hover:border-[#1935CA]/30 text-left transition group"
              >
                <div className="w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center text-teal-600 group-hover:scale-105 transition">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#1E293B] group-hover:text-[#1935CA] transition">
                    URL Article
                  </h4>
                  <p className="text-[10px] text-[#696F79]">SSRF Guarded</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsImageModalOpen(true)}
                className="flex items-center gap-3 p-3 rounded-xl bg-[#F8F9FC] hover:bg-[#EEF2FF] border border-slate-100 hover:border-[#1935CA]/30 text-left transition group"
              >
                <div className="w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center text-indigo-600 group-hover:scale-105 transition">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#1E293B] group-hover:text-[#1935CA] transition">
                    Image & Diagram
                  </h4>
                  <p className="text-[10px] text-[#696F79]">Gemini 2.5 Vision</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* ===================== RIGHT RAIL REGION (Dashboard.png Reference) ===================== */}
        <div className="w-full xl:w-[290px] shrink-0 space-y-6">
          <div className="bg-white rounded-[20px] p-5 shadow-[0_10px_30px_rgba(25,53,202,0.05)] border border-slate-100/80 space-y-6">
            {/* Live LLM Providers (Replaces 'Other Users Online') */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider">
                  Active LLM Providers
                </h3>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <div className="space-y-2.5">
                {providers.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-[#F8F9FC] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <div>
                        <span className="font-bold text-[#1E293B] block leading-tight">
                          {p.displayName}
                        </span>
                        <span className="text-[10px] text-[#696F79] font-mono block">
                          {p.defaultModel.replace('openai/', '').replace('meta/', '')}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-[#1935CA] bg-[#EEF2FF] px-2 py-0.5 rounded-full">
                      Ready
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mastery Badges (Replaces 'Achievements') */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider mb-3">
                Mastery Badges
              </h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-[#F8F9FC] flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1 text-xs">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-[#1E293B] leading-tight">
                    Deep Review
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-[#F8F9FC] flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-[#1935CA] flex items-center justify-center mb-1 text-xs">
                    <Zap className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-[#1E293B] leading-tight">
                    Zero Misses
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-[#F8F9FC] flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-1 text-xs">
                    <Award className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-[#1E293B] leading-tight">
                    7-Day Streak
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions / Reminders */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider mb-3">
                Quick Retakes & Links
              </h3>
              <div className="space-y-2 text-xs">
                <Link
                  to="/history"
                  className="p-2.5 rounded-xl bg-[#F8F9FC] hover:bg-[#EEF2FF] flex items-center justify-between text-[#1E293B] font-semibold transition group"
                >
                  <span className="group-hover:text-[#1935CA] transition">
                    View Completed Attempts
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#696F79] group-hover:text-[#1935CA]" />
                </Link>
                <Link
                  to="/classrooms"
                  className="p-2.5 rounded-xl bg-[#F8F9FC] hover:bg-[#EEF2FF] flex items-center justify-between text-[#1E293B] font-semibold transition group"
                >
                  <span className="group-hover:text-[#1935CA] transition">
                    Manage Classrooms
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#696F79] group-hover:text-[#1935CA]" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CodeQuizModal isOpen={isCodeModalOpen} onClose={() => setIsCodeModalOpen(false)} />
      <GenerateQuizModal isOpen={isGenerateModalOpen} onClose={() => setIsGenerateModalOpen(false)} />
      <PdfQuizModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} />
      <UrlQuizModal isOpen={isUrlModalOpen} onClose={() => setIsUrlModalOpen(false)} />
      <ImageQuizModal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} />
    </AppLayout>
  );
}
