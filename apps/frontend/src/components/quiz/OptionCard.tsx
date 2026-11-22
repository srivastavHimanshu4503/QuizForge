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
          ? 'bg-[#EEF2FF] border-2 border-[#1935CA] shadow-md shadow-[#1935CA]/10'
          : 'bg-[#F8F9FC] border-slate-200/80 hover:border-[#1935CA]/40 hover:bg-slate-50'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div
        className={`w-8 h-8 rounded-xl font-bold text-sm shrink-0 flex items-center justify-center transition ${
          isSelected
            ? 'bg-[#1935CA] text-white shadow-sm'
            : 'bg-white text-[#696F79] border border-slate-200 group-hover:border-[#1935CA]/50 group-hover:text-[#1935CA]'
        }`}
      >
        {isSelected ? <Check className="w-4 h-4 stroke-[3]" /> : choiceId}
      </div>

      <div className="flex-1 pt-0.5">
        <p
          className={`text-sm sm:text-base leading-relaxed ${
            isSelected ? 'text-[#1935CA] font-bold' : 'text-[#1E293B] font-medium'
          }`}
        >
          {optionText}
        </p>
      </div>

      <div
        className={`hidden sm:flex items-center justify-center w-6 h-6 rounded-lg text-[11px] font-mono font-bold transition shrink-0 ${
          isSelected
            ? 'bg-[#1935CA]/10 text-[#1935CA]'
            : 'bg-white text-slate-400 border border-slate-200 group-hover:border-[#1935CA]/40 group-hover:text-[#1935CA]'
        }`}
        title={`Press ${choiceId}`}
      >
        {choiceId}
      </div>
    </button>
  );
}
