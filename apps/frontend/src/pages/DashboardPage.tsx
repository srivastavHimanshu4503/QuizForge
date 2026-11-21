import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/layout/Navbar';
import { GenerateQuizModal } from '../components/quiz/GenerateQuizModal';
import { CodeQuizModal } from '../components/code-quiz/CodeQuizModal';
import { Sparkles, ShieldCheck, Brain, History, ArrowRight, Code2, Cpu } from 'lucide-react';

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

export function DashboardPage() {
  const { user } = useAuth();
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [activeDraft, setActiveDraft] = useState<ActiveDraft | null>(null);
  const [activeCodeDraft, setActiveCodeDraft] = useState<ActiveCodeDraft | null>(null);

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Authenticated Session Active</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
            Welcome back, {user?.displayName}!
          </h1>
          <p className="mt-2 text-slate-400 text-sm max-w-2xl">
            Generate topic-based MCQ quizzes or analyze public GitHub repositories with open-ended LLM-evaluated code reviews.
          </p>
        </header>

        {/* Resilient MCQ In-Progress Draft Banner */}
        {activeDraft && (
          <div className="mb-6 p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                    Unsaved MCQ Quiz in Progress
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-base font-bold text-white mt-0.5">
                  {activeDraft.topic} ({activeDraft.totalQuestions} Questions)
                </p>
                <p className="text-xs text-slate-400">
                  Preserved in browser storage — resume anytime without re-calling AI.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition"
              >
                Discard
              </button>
              <Link
                to={`/quiz/${activeDraft.attemptId}`}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition flex items-center gap-2"
              >
                <span>Resume Quiz</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Resilient Code Review In-Progress Draft Banner */}
        {activeCodeDraft && (
          <div className="mb-8 p-5 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                <Code2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                    Unsaved Code Review in Progress
                  </span>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                </div>
                <p className="text-base font-bold text-white mt-0.5">
                  {activeCodeDraft.repoUrl.replace('https://github.com/', '')} ({activeCodeDraft.totalQuestions} Questions)
                </p>
                <p className="text-xs text-slate-400">
                  Code answers and evaluations safely cached locally.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
              <button
                type="button"
                onClick={handleDiscardCodeDraft}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition"
              >
                Discard
              </button>
              <Link
                to={`/code-quiz/${activeCodeDraft.attemptId}`}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition flex items-center gap-2"
              >
                <span>Resume Code Review</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* 3-Card Interactive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: GitHub Code Review Quiz (Highlighted) */}
          <div
            onClick={() => setIsCodeModalOpen(true)}
            className="group bg-gradient-to-b from-slate-900 to-slate-900/90 border border-amber-500/30 hover:border-amber-400 rounded-3xl p-6 sm:p-7 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-xl hover:shadow-amber-500/10 hover:-translate-y-0.5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Code2 className="w-6 h-6" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-bold uppercase tracking-wider mb-2">
                <Sparkles className="w-3 h-3" />
                <span>New Assessment Mode</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-2 group-hover:text-amber-300 transition-colors">
                GitHub Code Review
              </h2>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Paste any public GitHub repository. Questions test whether you truly understand every line, comment, and design decision with open-ended LLM grading.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-amber-400 font-semibold flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                Groq • NVIDIA • Gemini
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-950 bg-amber-500 group-hover:bg-amber-400 px-3.5 py-2 rounded-xl shadow-md shadow-amber-500/20 transition"
              >
                <span>Review Repo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 2: MCQ Quiz Generation */}
          <div
            onClick={() => setIsGenerateModalOpen(true)}
            className="group bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 hover:border-indigo-500/60 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-0.5"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Brain className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">
                Topic MCQ Quiz
              </h2>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Choose any technical topic, question count (3 to 20 MCQs), and difficulty. Generates custom multiple-choice questions with Fisher-Yates retakes.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-indigo-400 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Gemini 2.5 Flash Engine
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 group-hover:bg-indigo-500 px-3.5 py-2 rounded-xl shadow-md shadow-indigo-600/20 transition"
              >
                <span>Generate</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 3: Past Quizzes & History */}
          <Link
            to="/history"
            className="group bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 hover:border-cyan-500/60 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-xl hover:shadow-cyan-500/5 hover:-translate-y-0.5"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <History className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                Quiz History & Review
              </h2>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Review your completed quiz scores, examine detailed answer explanations, and retake previous quizzes with freshly shuffled sequences.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-cyan-400 font-semibold">
                History & Review
              </span>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-slate-800 group-hover:bg-cyan-600 px-3.5 py-2 rounded-xl transition">
                <span>View History</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </Link>
        </div>

        {/* Security & Multi-tenancy status banner */}
        <div className="mt-8 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              Multi-Tenant Data Isolation Active: User ID: <code className="text-slate-300 font-mono">{user?.id}</code>
            </span>
          </div>
          <span className="text-emerald-400 font-medium">HTTP-Only Cookie Authenticated</span>
        </div>
      </main>

      {/* MCQ Generation Modal */}
      <GenerateQuizModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
      />

      {/* Code Review Quiz Generation Modal */}
      <CodeQuizModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
      />
    </div>
  );
}
