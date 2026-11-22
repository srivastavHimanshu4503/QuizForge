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

  let badgeColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  let ratingText = 'Outstanding Performance!';

  if (accuracyPercentage < 50) {
    badgeColor = 'text-rose-700 bg-rose-50 border-rose-200';
    ratingText = 'Keep Practicing & Review Concepts';
  } else if (accuracyPercentage < 80) {
    badgeColor = 'text-amber-700 bg-amber-50 border-amber-200';
    ratingText = 'Good Effort! Solid Foundation';
  }

  return (
    <div className="bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 rounded-[20px] p-6 sm:p-8 shadow-[0_10px_30px_rgba(25,53,202,0.05)] relative overflow-hidden transition-colors duration-200">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#F8F9FC] dark:bg-slate-800 text-[#696F79] dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              {difficulty}
            </span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#EEF2FF] dark:bg-slate-800 text-[#1935CA] dark:text-[#38BDF8] border border-[#1935CA]/20 dark:border-slate-700 flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              Attempt #{attemptNumber}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E293B] dark:text-[#F8FAFC] tracking-tight">
            {topic}
          </h1>
        </div>

        <div className={`px-4 py-2 rounded-2xl border text-sm font-bold flex items-center gap-2 ${badgeColor}`}>
          <Award className="w-4 h-4 shrink-0" />
          <span>{ratingText}</span>
        </div>
      </div>

      {/* Main Score Hero */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-2">
        {/* Score Card */}
        <div className="bg-[#F8F9FC] dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-bold text-[#696F79] dark:text-slate-400 uppercase tracking-wider">
            Final Score
          </span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black text-[#1935CA] dark:text-[#38BDF8]">{score}</span>
            <span className="text-sm font-bold text-[#696F79] dark:text-slate-400">/ {totalQuestions}</span>
          </div>
          <span className="text-[11px] text-[#696F79] dark:text-slate-400 font-medium mt-2">1 point per correct answer</span>
        </div>

        {/* Accuracy Card */}
        <div className="bg-[#F8F9FC] dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-bold text-[#696F79] dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Percent className="w-3.5 h-3.5 text-[#1935CA] dark:text-[#38BDF8]" />
            Accuracy
          </span>
          <div className="mt-3">
            <span className="text-4xl sm:text-5xl font-black text-[#1935CA] dark:text-[#38BDF8]">
              {accuracyPercentage}%
            </span>
          </div>
          {/* Mini progress bar */}
          <div className="w-full bg-[#EEF2FF] dark:bg-slate-700 h-2 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#1935CA] to-[#38BDF8] h-full rounded-full"
              style={{ width: `${accuracyPercentage}%` }}
            />
          </div>
        </div>

        {/* Correct Answers */}
        <div className="bg-[#F8F9FC] dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Correct
          </span>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-emerald-700 dark:text-emerald-400">
              {correctCount}
            </span>
          </div>
          <span className="text-[11px] text-[#696F79] dark:text-slate-400 font-medium mt-2">
            {totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}% of total
          </span>
        </div>

        {/* Incorrect & Unanswered */}
        <div className="bg-[#F8F9FC] dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" />
              Missed: {incorrectCount}
            </span>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Skipped: {unansweredCount}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <div>
              <span className="text-2xl font-extrabold text-rose-700 dark:text-rose-400">{incorrectCount}</span>
              <span className="text-[11px] text-[#696F79] dark:text-slate-400 block font-medium">Incorrect</span>
            </div>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
            <div>
              <span className="text-2xl font-extrabold text-amber-700 dark:text-amber-400">{unansweredCount}</span>
              <span className="text-[11px] text-[#696F79] dark:text-slate-400 block font-medium">Unanswered</span>
            </div>
          </div>
          <span className="text-[11px] text-[#696F79] dark:text-slate-400 font-medium mt-2">Review answers below</span>
        </div>
      </div>
    </div>
  );
}
