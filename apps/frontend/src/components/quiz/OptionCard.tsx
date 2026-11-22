import { ChoiceId } from '@quiz-forge/shared';
import { Check } from 'lucide-react';

interface OptionCardProps {
  choiceId: ChoiceId;
  optionText: string;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

export function OptionCard({
  choiceId,
  optionText,
  isSelected,
  onSelect,
  disabled,
}: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex items-start gap-4 group ${
        isSelected
          ? 'bg-[#EEF2FF] dark:bg-indigo-950/60 border-2 border-[#1935CA] dark:border-[#38BDF8] shadow-md shadow-[#1935CA]/10'
          : 'bg-[#F8F9FC] dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60 hover:border-[#1935CA]/40 dark:hover:border-[#38BDF8]/40 hover:bg-slate-50 dark:hover:bg-slate-800'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div
        className={`w-8 h-8 rounded-xl font-bold text-sm shrink-0 flex items-center justify-center transition ${
          isSelected
            ? 'bg-[#1935CA] text-white shadow-sm'
            : 'bg-white dark:bg-[#151C2C] text-[#696F79] dark:text-slate-400 border border-slate-200 dark:border-slate-700 group-hover:border-[#1935CA]/50 group-hover:text-[#1935CA] dark:group-hover:text-[#38BDF8]'
        }`}
      >
        {isSelected ? <Check className="w-4 h-4 stroke-[3]" /> : choiceId}
      </div>

      <div className="flex-1 pt-0.5">
        <p
          className={`text-sm sm:text-base leading-relaxed ${
            isSelected ? 'text-[#1935CA] dark:text-[#38BDF8] font-bold' : 'text-[#1E293B] dark:text-[#F8FAFC] font-medium'
          }`}
        >
          {optionText}
        </p>
      </div>

      <div
        className={`hidden sm:flex items-center justify-center w-6 h-6 rounded-lg text-[11px] font-mono font-bold transition shrink-0 ${
          isSelected
            ? 'bg-[#1935CA]/10 dark:bg-[#38BDF8]/20 text-[#1935CA] dark:text-[#38BDF8]'
            : 'bg-white dark:bg-[#151C2C] text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 group-hover:border-[#1935CA]/40 group-hover:text-[#1935CA] dark:group-hover:text-[#38BDF8]'
        }`}
        title={`Press ${choiceId}`}
      >
        {choiceId}
      </div>
    </button>
  );
}
