import { useEffect, useState } from 'react';
import { QuizPsychometricsDto } from '@quiz-forge/shared';
import { apiClient, ApiError } from '../../api/client';
import {
  BarChart3,
  X,
  Loader2,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';

interface InstitutionalPsychometricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizId: string;
}

export function InstitutionalPsychometricsModal({
  isOpen,
  onClose,
  quizId,
}: InstitutionalPsychometricsModalProps) {
  const [data, setData] = useState<QuizPsychometricsDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !quizId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await apiClient.get<QuizPsychometricsDto>(
          `/api/quizzes/${quizId}/psychometrics`
        );
        if (isMounted) {
          setData(res);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(
            err instanceof ApiError ? err.message : 'Failed to load psychometric analysis.'
          );
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isOpen, quizId]);

  if (!isOpen) return null;

  const getReliabilityBadge = (classification: string) => {
    switch (classification) {
      case 'excellent':
        return { label: 'Excellent Reliability (α ≥ 0.90)', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200' };
      case 'good':
        return { label: 'Good Reliability (α ≥ 0.80)', color: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200' };
      case 'acceptable':
        return { label: 'Acceptable (α ≥ 0.70)', color: 'text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200' };
      case 'questionable':
        return { label: 'Questionable (α ≥ 0.60)', color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200' };
      default:
        return { label: 'Unacceptable (α < 0.60)', color: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200' };
    }
  };

  const getDiscriminationBadge = (rating: string) => {
    switch (rating) {
      case 'excellent':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200';
      case 'good':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200';
      case 'fair':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200';
      case 'poor':
        return 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200';
      default:
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 animate-pulse';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-50/50 via-indigo-50/20 to-transparent dark:from-slate-800/40 dark:via-slate-800/10 dark:to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1935CA] text-white flex items-center justify-center shadow-md shadow-[#1935CA]/25">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Institutional Cohort Psychometrics
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#1935CA]/10 text-[#1935CA] dark:text-[#38BDF8]/10 dark:text-[#38BDF8]">
                  Classical Test Theory
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Item discrimination, Cronbach's Alpha internal consistency, and facility indices.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {isLoading && (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-[#1935CA] dark:text-[#38BDF8] animate-spin mb-3" />
              <p className="text-xs font-semibold text-slate-500">Calculating point-biserial correlations & variance matrices...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {data && !isLoading && (
            <>
              {/* Reliability & Core Stat Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cronbach's Alpha (α)</div>
                  <div className="text-2xl font-black text-[#1935CA] dark:text-[#38BDF8] mt-1">
                    {data.cronbachAlpha.toFixed(2)}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 mt-0.5">Internal Consistency</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cohort Sample Size</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {data.sampleSize}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 mt-0.5">Examinee Submissions</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mean / Median Score</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {data.meanScore.toFixed(1)} <span className="text-sm font-normal text-slate-400">/ {data.medianScore}</span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 mt-0.5">SD: ±{data.standardDeviation.toFixed(2)}</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Standard Error (SEM)</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    ± {data.standardErrorOfMeasurement.toFixed(2)}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 mt-0.5">Measurement Margin</div>
                </div>
              </div>

              {/* Reliability Badge Banner */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getReliabilityBadge(data.reliabilityClassification).color}`}>
                    {getReliabilityBadge(data.reliabilityClassification).label}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                    {data.sampleSize < 10 ? '(Small sample size - estimates will refine with additional attempts)' : 'Validated across cohort'}
                  </span>
                </div>
              </div>

              {/* Score Distribution Histogram */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Cohort Score Distribution
                  </h4>
                  <span className="text-[11px] font-semibold text-slate-400">5 Score Brackets</span>
                </div>

                <div className="grid grid-cols-5 gap-2 items-end h-28 pt-2">
                  {data.scoreDistribution.map((bucket) => (
                    <div key={bucket.range} className="flex flex-col items-center h-full justify-end gap-1.5">
                      <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
                        {bucket.count} ({bucket.percentage}%)
                      </span>
                      <div className="w-full bg-slate-200 dark:bg-slate-700/60 rounded-t-lg h-full flex items-end overflow-hidden">
                        <div
                          className="w-full bg-[#1935CA] dark:bg-[#38BDF8] rounded-t-lg transition-all duration-500"
                          style={{ height: `${Math.max(8, bucket.percentage)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                        {bucket.range}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Item Psychometrics Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Item-Level Discrimination & Facility Indices
                  </h4>
                  <span className="text-[11px] font-semibold text-slate-400">Point-Biserial Correlation (r_pb)</span>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3.5">#</th>
                        <th className="py-2.5 px-3.5">Question Prompt</th>
                        <th className="py-2.5 px-3.5 text-center">Facility (p)</th>
                        <th className="py-2.5 px-3.5 text-center">Discrimination (r_pb)</th>
                        <th className="py-2.5 px-3.5 text-right">Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {data.items.map((item) => (
                        <tr key={item.questionId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3.5 font-bold font-mono text-[#1935CA] dark:text-[#38BDF8]">
                            Q{item.questionOrder}
                          </td>
                          <td className="py-2.5 px-3.5 max-w-xs truncate font-medium">
                            {item.questionText}
                          </td>
                          <td className="py-2.5 px-3.5 text-center font-mono">
                            {(item.facilityIndex * 100).toFixed(0)}%
                          </td>
                          <td className="py-2.5 px-3.5 text-center font-mono font-bold">
                            {item.discriminationIndex >= 0 ? `+${item.discriminationIndex.toFixed(2)}` : item.discriminationIndex.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3.5 text-right">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${getDiscriminationBadge(item.discriminationRating)}`}>
                              {item.discriminationRating}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recommendations Box */}
              {data.recommendations.length > 0 && (
                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                    <Lightbulb className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8]" />
                    <span>Pedagogical & Distractor Insights</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-5 list-disc">
                    {data.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Complies with IMS Global CTT Standards & Canvas/Moodle Analytics
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1935CA] text-white hover:bg-[#142BA3] transition shadow-md shadow-[#1935CA]/20"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
