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
    easy: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    medium: 'text-amber-700 bg-amber-50 border-amber-200',
    hard: 'text-rose-700 bg-rose-50 border-rose-200',
    mixed: 'text-[#1935CA] bg-[#EEF2FF] border-[#1935CA]/20',
  };

  return (
    <div className="bg-white border border-slate-100 rounded-[20px] p-5 mb-6 shadow-[0_10px_30px_rgba(25,53,202,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-base sm:text-lg font-bold text-[#1E293B] tracking-tight truncate max-w-xs sm:max-w-md">
            {topic}
          </span>
          <span
            className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
              difficultyColors[difficulty] || difficultyColors.mixed
            }`}
          >
            {difficulty}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Autosave Indicator */}
          <div className="flex items-center gap-1.5 text-xs text-[#696F79] font-medium">
            {autosaveStatus === 'saving' && (
              <>
                <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                <span className="text-amber-600">Saving...</span>
              </>
            )}
            {autosaveStatus === 'saved' && (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">Saved</span>
              </>
            )}
            {autosaveStatus === 'error' && (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-rose-600">Save error</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg bg-[#EEF2FF] text-[#1935CA]">
            <Sparkles className="w-3 h-3 text-[#1935CA]" />
            <span>
              {currentIndex + 1} / {totalQuestions}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-[#EEF2FF] h-2.5 rounded-full overflow-hidden">
        <div
          className="bg-gradient-to-r from-[#1935CA] to-[#38BDF8] h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
