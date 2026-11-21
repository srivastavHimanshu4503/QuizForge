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
          ? 'bg-indigo-600/15 border-indigo-500 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500'
          : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div
        className={`w-8 h-8 rounded-xl font-bold text-sm shrink-0 flex items-center justify-center transition ${
          isSelected
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'bg-slate-800 text-slate-300 group-hover:bg-slate-700 border border-slate-700'
        }`}
      >
        {isSelected ? <Check className="w-4 h-4 stroke-[3]" /> : choiceId}
      </div>

      <div className="flex-1 pt-0.5">
        <p
          className={`text-sm sm:text-base leading-relaxed ${
            isSelected ? 'text-white font-medium' : 'text-slate-300'
          }`}
        >
          {optionText}
        </p>
      </div>
    </button>
  );
}
