import { Sparkles, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { QuestionDifficultyTier, classifyTheta } from '@quiz-forge/shared';

interface AdaptiveAbilityGaugeProps {
  theta: number;
  standardError?: number;
  difficultyTier?: QuestionDifficultyTier | string;
  delta?: number | null;
  compact?: boolean;
}

export function AdaptiveAbilityGauge({
  theta,
  standardError = 0.5,
  difficultyTier = 'medium',
  delta = null,
  compact = false,
}: AdaptiveAbilityGaugeProps) {
  const tierName = classifyTheta(theta);

  // Normalize theta from [-3.0, +3.0] to [0%, 100%]
  const clampedTheta = Math.max(-3.0, Math.min(3.0, theta));
  const percentage = Math.round(((clampedTheta + 3.0) / 6.0) * 100);

  // Difficulty Tier styling
  const getTierBadge = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'easy':
        return {
          label: 'Foundational (Easy)',
          bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
          text: 'text-emerald-700 dark:text-emerald-400',
          border: 'border-emerald-200 dark:border-emerald-800',
        };
      case 'medium':
        return {
          label: 'Applied (Medium)',
          bg: 'bg-blue-500/10 dark:bg-blue-500/20',
          text: 'text-blue-700 dark:text-blue-400',
          border: 'border-blue-200 dark:border-blue-800',
        };
      case 'hard':
        return {
          label: 'Advanced (Hard)',
          bg: 'bg-purple-500/10 dark:bg-purple-500/20',
          text: 'text-purple-700 dark:text-purple-400',
          border: 'border-purple-200 dark:border-purple-800',
        };
      case 'expert':
        return {
          label: 'Expert (Mastery)',
          bg: 'bg-amber-500/10 dark:bg-amber-500/20',
          text: 'text-amber-700 dark:text-amber-400',
          border: 'border-amber-200 dark:border-amber-800',
        };
      default:
        return {
          label: tier,
          bg: 'bg-slate-100 dark:bg-slate-800',
          text: 'text-slate-700 dark:text-slate-300',
          border: 'border-slate-200 dark:border-slate-700',
        };
    }
  };

  const tierBadge = getTierBadge(difficultyTier);

  const getProficiencyTheme = (tier: string) => {
    switch (tier) {
      case 'Novice':
        return { color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-500', gradient: 'from-slate-400 to-slate-600' };
      case 'Developing':
        return { color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500', gradient: 'from-sky-400 to-blue-600' };
      case 'Proficient':
        return { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500', gradient: 'from-blue-500 to-emerald-500' };
      case 'Advanced':
        return { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500', gradient: 'from-emerald-500 to-purple-600' };
      case 'Master':
        return { color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500', gradient: 'from-purple-600 to-amber-500' };
      default:
        return { color: 'text-blue-600', bg: 'bg-blue-500', gradient: 'from-blue-400 to-blue-600' };
    }
  };

  const profTheme = getProficiencyTheme(tierName);

  if (compact) {
    return (
      <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-1.5">
          <Target className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8]" />
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Ability:</span>
          <span className="text-xs font-black text-slate-900 dark:text-white">
            {theta >= 0 ? `+${theta.toFixed(2)}` : theta.toFixed(2)} θ
          </span>
        </div>

        {delta !== null && (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
              delta >= 0
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
            }`}
          >
            {delta >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)}
          </span>
        )}

        <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${tierBadge.bg} ${tierBadge.text} ${tierBadge.border}`}>
          {tierBadge.label}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] dark:bg-slate-800 flex items-center justify-center text-[#1935CA] dark:text-[#38BDF8]">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Computerized Adaptive HUD
            </h4>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span>Item Response Theory (IRT 1-PL)</span>
              <span>•</span>
              <span>SE ± {standardError.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {delta !== null && (
            <div
              className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 animate-pulse ${
                delta >= 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40'
              }`}
            >
              {delta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)} θ</span>
            </div>
          )}

          <div className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${tierBadge.bg} ${tierBadge.text} ${tierBadge.border}`}>
            {tierBadge.label}
          </div>
        </div>
      </div>

      {/* Ability Scale Gauge */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Estimated Latent Ability (θ):</span>
            <span className={`text-sm font-black ${profTheme.color}`}>
              {theta >= 0 ? `+${theta.toFixed(2)}` : theta.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-extrabold text-[#1935CA] dark:text-[#38BDF8]">
            <Sparkles className="w-3 h-3" />
            <span>Tier: {tierName}</span>
          </div>
        </div>

        <div className="relative h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          {/* Baseline Indicator at theta=0 (50%) */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-400 dark:bg-slate-600 z-10 opacity-70" />

          {/* Ability Bar */}
          <div
            className={`h-full bg-gradient-to-r ${profTheme.gradient} transition-all duration-500 rounded-full`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 px-0.5">
          <span>-3.0 (Novice)</span>
          <span className="font-semibold text-slate-500 dark:text-slate-400">0.0 (Average)</span>
          <span>+3.0 (Master)</span>
        </div>
      </div>
    </div>
  );
}
