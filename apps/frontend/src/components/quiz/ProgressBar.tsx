import { AutosaveStatus } from '../../hooks/useQuizAttempt';
import { Check, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { QuizDifficulty } from '@quiz-forge/shared';

interface ProgressBarProps {
  currentIndex: number;
  totalQuestions: number;
  topic: string;
  difficulty: QuizDifficulty;
  autosaveStatus: AutosaveStatus;
}

export function ProgressBar({
  currentIndex,
  totalQuestions,
  topic,
  difficulty,
  autosaveStatus,
}: ProgressBarProps) {
  const percentage = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  const difficultyColors: Record<QuizDifficulty, string> = {
    easy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    hard: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    mixed: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 mb-6 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-base sm:text-lg font-bold text-white tracking-tight truncate max-w-xs sm:max-w-md">
            {topic}
          </span>
          <span
            className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              difficultyColors[difficulty] || difficultyColors.mixed
            }`}
          >
            {difficulty}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Autosave Indicator */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            {autosaveStatus === 'saving' && (
              <>
                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span className="text-amber-400">Saving...</span>
              </>
            )}
            {autosaveStatus === 'saved' && (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-400">Saved</span>
              </>
            )}
            {autosaveStatus === 'error' && (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-rose-400">Save error</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>
              {currentIndex + 1} / {totalQuestions}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
        <div
          className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
