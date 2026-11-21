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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
          Question Palette
        </h3>
        <span className="text-xs text-slate-400">
          <strong className="text-emerald-400">{answeredCount}</strong> / {questions.length} answered
        </span>
      </div>

      <div className="grid grid-cols-5 gap-2.5 sm:gap-3">
        {questions.map((q, idx) => {
          const isAnswered = answers[q.question_id] !== null && answers[q.question_id] !== undefined;
          const isCurrent = idx === currentIndex;

          let badgeStyle = 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700';

          if (isAnswered) {
            badgeStyle = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-semibold';
          }

          if (isCurrent) {
            badgeStyle = 'bg-indigo-600 text-white font-bold ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900 border-transparent shadow-md';
          }

          return (
            <button
              key={q.question_id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectIndex(idx)}
              className={`h-10 rounded-xl border text-xs flex items-center justify-center transition-all duration-150 relative cursor-pointer ${badgeStyle}`}
              title={`Question ${idx + 1}${isAnswered ? ' (Answered)' : ' (Unanswered)'}`}
            >
              <span>{idx + 1}</span>
              {isAnswered && !isCurrent && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
          <span>Unanswered</span>
        </div>
      </div>
    </div>
  );
}
