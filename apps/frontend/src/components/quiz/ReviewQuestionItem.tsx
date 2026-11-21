import { QuestionReview } from '@quiz-forge/shared';
import { Check, X, AlertCircle, Info } from 'lucide-react';

interface ReviewQuestionItemProps {
  questionNumber: number;
  review: QuestionReview;
}

export function ReviewQuestionItem({
  questionNumber,
  review,
}: ReviewQuestionItemProps) {
  const {
    question,
    choices,
    selected_choice_id,
    correct_choice_id,
    is_correct,
    explanation,
  } = review;

  const isSkipped = selected_choice_id === null || selected_choice_id === undefined;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Question {questionNumber}
        </span>

        {is_correct && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            Correct
          </span>
        )}

        {!is_correct && !isSkipped && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <X className="w-3.5 h-3.5 stroke-[3]" />
            Incorrect (You chose {selected_choice_id})
          </span>
        )}

        {isSkipped && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            Unanswered / Skipped
          </span>
        )}
      </div>

      <h3 className="text-lg sm:text-xl font-bold text-white mb-6 leading-relaxed">
        {question}
      </h3>

      {/* Choices Grid */}
      <div className="space-y-3 mb-6">
        {choices.map((choice) => {
          const isCorrectChoice = choice.choice_id === correct_choice_id;
          const isUserChoice = choice.choice_id === selected_choice_id;

          let cardStyle = 'bg-slate-950/60 border-slate-800 text-slate-300';
          let badgeStyle = 'bg-slate-800 text-slate-400 border-slate-700';

          if (isCorrectChoice) {
            cardStyle = 'bg-emerald-500/10 border-emerald-500/40 text-white ring-1 ring-emerald-500/30';
            badgeStyle = 'bg-emerald-500 text-slate-950 font-bold';
          } else if (isUserChoice && !is_correct) {
            cardStyle = 'bg-rose-500/10 border-rose-500/40 text-white ring-1 ring-rose-500/30';
            badgeStyle = 'bg-rose-500 text-white font-bold';
          }

          return (
            <div
              key={choice.choice_id}
              className={`p-4 rounded-2xl border flex items-start justify-between gap-3 transition ${cardStyle}`}
            >
              <div className="flex items-start gap-3.5">
                <span
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 mt-0.5 border ${badgeStyle}`}
                >
                  {choice.choice_id}
                </span>
                <span className="text-sm sm:text-base leading-relaxed pt-0.5">
                  {choice.option_text}
                </span>
              </div>

              <div className="shrink-0 flex items-center gap-2 pt-1">
                {isCorrectChoice && (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    Correct Answer
                  </span>
                )}
                {isUserChoice && !isCorrectChoice && (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                    Your Selection
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Authoritative Explanation Callout */}
      <div className="p-4 sm:p-5 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 flex items-start gap-3.5">
        <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-indigo-200/90 leading-relaxed">
          <strong className="block text-indigo-300 font-semibold mb-1">
            Explanation:
          </strong>
          {explanation}
        </div>
      </div>
    </div>
  );
}
