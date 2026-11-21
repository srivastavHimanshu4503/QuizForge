import { AttemptResult } from '@quiz-forge/shared';
import { Award, CheckCircle2, XCircle, AlertTriangle, Percent, RotateCcw } from 'lucide-react';

interface ScoreCardProps {
  result: AttemptResult;
}

export function ScoreCard({ result }: ScoreCardProps) {
  const {
    topic,
    difficulty,
    attemptNumber,
    score,
    totalQuestions,
    correctCount,
    incorrectCount,
    unansweredCount,
    accuracyPercentage,
  } = result;

  let badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  let ratingText = 'Outstanding Performance!';

  if (accuracyPercentage < 50) {
    badgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    ratingText = 'Keep Practicing & Review Concepts';
  } else if (accuracyPercentage < 80) {
    badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    ratingText = 'Good Effort! Solid Foundation';
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {difficulty}
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              Attempt #{attemptNumber}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {topic}
          </h1>
        </div>

        <div className={`px-4 py-2 rounded-2xl border text-sm font-bold flex items-center gap-2 ${badgeColor}`}>
          <Award className="w-4 h-4 shrink-0" />
          <span>{ratingText}</span>
        </div>
      </div>

      {/* Main Score Hero */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        {/* Score Card */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Final Score
          </span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black text-white">{score}</span>
            <span className="text-sm font-semibold text-slate-500">/ {totalQuestions}</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-2">1 point per correct answer</span>
        </div>

        {/* Accuracy Card */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Percent className="w-3.5 h-3.5 text-cyan-400" />
            Accuracy
          </span>
          <div className="mt-3">
            <span className="text-4xl sm:text-5xl font-black text-cyan-400">
              {accuracyPercentage}%
            </span>
          </div>
          {/* Mini progress bar */}
          <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2 overflow-hidden border border-slate-800">
            <div
              className="bg-cyan-400 h-full rounded-full"
              style={{ width: `${accuracyPercentage}%` }}
            />
          </div>
        </div>

        {/* Correct Answers */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Correct
          </span>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-emerald-400">
              {correctCount}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 mt-2">
            {totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}% of total
          </span>
        </div>

        {/* Incorrect & Unanswered */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" />
              Missed: {incorrectCount}
            </span>
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Skipped: {unansweredCount}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <div>
              <span className="text-2xl font-bold text-rose-400">{incorrectCount}</span>
              <span className="text-[11px] text-slate-500 block">Incorrect</span>
            </div>
            <div className="h-6 w-px bg-slate-800"></div>
            <div>
              <span className="text-2xl font-bold text-amber-400">{unansweredCount}</span>
              <span className="text-[11px] text-slate-500 block">Unanswered</span>
            </div>
          </div>
          <span className="text-[11px] text-slate-500 mt-2">Review answers below</span>
        </div>
      </div>
    </div>
  );
}
