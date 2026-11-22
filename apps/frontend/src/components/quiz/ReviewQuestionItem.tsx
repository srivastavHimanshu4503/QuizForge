import { QuestionReview } from '@quiz-forge/shared';
import { Check, X, AlertCircle, Info } from 'lucide-react';
import { SocraticAudioPlayer } from '../audio/SocraticAudioPlayer';

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
    <div className="bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 rounded-[20px] p-6 sm:p-7 shadow-[0_10px_30px_rgba(25,53,202,0.05)] transition-colors duration-200">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <span className="text-xs font-extrabold uppercase tracking-wider text-[#1935CA] dark:text-[#38BDF8]">
          Question {questionNumber}
        </span>

        {is_correct && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            Correct
          </span>
        )}

        {!is_correct && !isSkipped && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <X className="w-3.5 h-3.5 stroke-[3]" />
            Incorrect (You chose {selected_choice_id})
          </span>
        )}

        {isSkipped && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-3.5 h-3.5" />
            Unanswered / Skipped
          </span>
        )}
      </div>

      <h3 className="text-lg sm:text-xl font-bold text-[#1E293B] dark:text-[#F8FAFC] mb-6 leading-relaxed">
        {question}
      </h3>

      {/* Choices Grid */}
      <div className="space-y-3 mb-6">
        {choices.map((choice) => {
          const isCorrectChoice = choice.choice_id === correct_choice_id;
          const isUserChoice = choice.choice_id === selected_choice_id;

          let cardStyle = 'bg-[#F8F9FC] dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60 text-[#1E293B] dark:text-[#F8FAFC]';
          let badgeStyle = 'bg-white dark:bg-[#151C2C] text-[#696F79] dark:text-slate-400 border-slate-200 dark:border-slate-700';

          if (isCorrectChoice) {
            cardStyle = 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200 ring-1 ring-emerald-200 dark:ring-emerald-800';
            badgeStyle = 'bg-emerald-600 text-white font-bold border-transparent';
          } else if (isUserChoice && !is_correct) {
            cardStyle = 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-950 dark:text-rose-200 ring-1 ring-rose-200 dark:ring-rose-800';
            badgeStyle = 'bg-rose-600 text-white font-bold border-transparent';
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
                <span className="text-sm sm:text-base leading-relaxed pt-0.5 font-medium">
                  {choice.option_text}
                </span>
              </div>

              <div className="shrink-0 flex items-center gap-2 pt-1">
                {isCorrectChoice && (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full">
                    Correct Answer
                  </span>
                )}
                {isUserChoice && !isCorrectChoice && (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950 px-2.5 py-0.5 rounded-full">
                    Your Selection
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Authoritative Explanation Callout */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#EEF2FF] dark:bg-indigo-950/40 border border-[#1935CA]/20 dark:border-indigo-800/40 flex items-start gap-3.5 mb-4">
        <Info className="w-5 h-5 text-[#1935CA] dark:text-[#38BDF8] shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-[#1E293B] dark:text-[#F8FAFC] leading-relaxed">
          <strong className="block text-[#1935CA] dark:text-[#38BDF8] font-bold mb-1">
            Explanation:
          </strong>
          {explanation}
        </div>
      </div>

      {/* Milestone 15: Socratic Audio Walkthrough Player */}
      <SocraticAudioPlayer
        questionText={question}
        selectedChoiceText={choices.find((c) => c.choice_id === selected_choice_id)?.option_text}
        correctChoiceText={choices.find((c) => c.choice_id === correct_choice_id)?.option_text || ''}
        isCorrect={Boolean(is_correct)}
        explanation={explanation}
      />
    </div>
  );
}
