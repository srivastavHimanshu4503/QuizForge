import { ClientQuestion, ChoiceId } from '@quiz-forge/shared';
import { Check } from 'lucide-react';

interface QuestionPaletteProps {
  questions: ClientQuestion[];
  currentIndex: number;
  answers: Record<string, ChoiceId | null>;
  onSelectIndex: (index: number) => void;
  disabled?: boolean;
}

export function QuestionPalette({
  questions,
  currentIndex,
  answers,
  onSelectIndex,
  disabled,
}: QuestionPaletteProps) {
  const answeredCount = questions.filter(
    (q) => answers[q.question_id] !== null && answers[q.question_id] !== undefined
  ).length;

  return (
    <div className="bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 rounded-[20px] p-5 shadow-[0_10px_30px_rgba(25,53,202,0.05)] transition-colors duration-200">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-xs font-bold text-[#696F79] dark:text-slate-400 uppercase tracking-wider">
          Question Palette
        </h3>
        <span className="text-xs text-[#696F79] dark:text-slate-400 font-medium">
          <strong className="text-[#1935CA] dark:text-[#38BDF8] font-bold">{answeredCount}</strong> / {questions.length} answered
        </span>
      </div>

      <div className="grid grid-cols-5 gap-2.5 sm:gap-3">
        {questions.map((q, idx) => {
          const isAnswered = answers[q.question_id] !== null && answers[q.question_id] !== undefined;
          const isCurrent = idx === currentIndex;

          let badgeStyle = 'bg-[#F8F9FC] dark:bg-slate-800 text-[#696F79] dark:text-slate-400 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-[#1E293B] dark:hover:text-white';

          if (isAnswered) {
            badgeStyle = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-bold';
          }

          if (isCurrent) {
            badgeStyle = 'bg-[#1935CA] text-white font-extrabold ring-2 ring-[#1935CA] dark:ring-[#38BDF8] ring-offset-2 dark:ring-offset-[#151C2C] border-transparent shadow-md';
          }

          return (
            <button
              key={q.question_id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectIndex(idx)}
              className={`h-10 rounded-xl border text-xs flex items-center justify-center transition-all duration-150 relative cursor-pointer font-bold ${badgeStyle}`}
              title={`Question ${idx + 1}${isAnswered ? ' (Answered)' : ' (Unanswered)'}`}
            >
              <span>{idx + 1}</span>
              {isAnswered && !isCurrent && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-[#696F79] dark:text-slate-400 font-medium">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#1935CA]"></div>
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600"></div>
          <span>Unanswered</span>
        </div>
      </div>
    </div>
  );
}
