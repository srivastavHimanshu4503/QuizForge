import { useState } from 'react';
import { AdaptiveAbilityPointDto, calculatePercentile, classifyTheta } from '@quiz-forge/shared';
import { CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';

interface AdaptiveTrajectoryChartProps {
  trajectory: AdaptiveAbilityPointDto[];
  finalTheta: number;
  standardError: number;
  percentile?: number;
  abilityTier?: string;
}

export function AdaptiveTrajectoryChart({
  trajectory,
  finalTheta,
  standardError,
  percentile,
  abilityTier,
}: AdaptiveTrajectoryChartProps) {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(
    trajectory.length > 0 ? trajectory.length - 1 : null
  );

  const calculatedPercentile = percentile ?? calculatePercentile(finalTheta);
  const calculatedTier = abilityTier ?? classifyTheta(finalTheta);

  if (!trajectory || trajectory.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
        <p className="text-slate-500 dark:text-slate-400 text-sm">No adaptive trajectory data available for this attempt.</p>
      </div>
    );
  }

  // Chart Dimensions
  const width = 640;
  const height = 280;
  const padding = { top: 25, right: 30, bottom: 40, left: 45 };

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Y scale: Theta from -3.0 to +3.0
  const yMin = -3.0;
  const yMax = 3.0;
  const getY = (thetaVal: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, thetaVal));
    const ratio = (clamped - yMin) / (yMax - yMin);
    return padding.top + innerHeight * (1 - ratio);
  };

  // X scale: Step 1 to N
  const totalSteps = Math.max(trajectory.length, 1);
  const getX = (stepIndex: number) => {
    if (totalSteps <= 1) return padding.left + innerWidth / 2;
    return padding.left + (stepIndex / (totalSteps - 1)) * innerWidth;
  };

  // Build Trajectory Polyline
  const pointsString = trajectory
    .map((pt, idx) => `${getX(idx).toFixed(1)},${getY(pt.theta).toFixed(1)}`)
    .join(' ');

  // Build Standard Error Confidence Ribbon
  const upperBand = trajectory.map((pt, idx) => ({
    x: getX(idx),
    y: getY(pt.theta + pt.standardError),
  }));
  const lowerBand = [...trajectory].reverse().map((pt, revIdx) => {
    const idx = trajectory.length - 1 - revIdx;
    return {
      x: getX(idx),
      y: getY(pt.theta - pt.standardError),
    };
  });

  const ribbonPath = [
    `M ${upperBand[0]!.x.toFixed(1)} ${upperBand[0]!.y.toFixed(1)}`,
    ...upperBand.slice(1).map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
    ...lowerBand.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
    'Z',
  ].join(' ');

  const selectedPoint = selectedPointIndex !== null ? trajectory[selectedPointIndex] : null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#1935CA]/10 text-[#1935CA] dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]">
              IRT Ability Trajectory
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">1-PL Rasch Model (SE ± {standardError.toFixed(2)})</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
            Dynamic Adaptive Latent Ability Calibration
          </h3>
        </div>

        {/* High-level Score Indicators */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-center">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Final Ability (θ)</div>
            <div className="text-base font-black text-slate-900 dark:text-white">
              {finalTheta >= 0 ? `+${finalTheta.toFixed(2)}` : finalTheta.toFixed(2)}
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-[#EEF2FF] dark:bg-[#1935CA]/20 border border-[#1935CA]/20 text-center">
            <div className="text-[10px] uppercase font-bold text-[#1935CA] dark:text-[#38BDF8] tracking-wider">
              Normative Rank
            </div>
            <div className="text-base font-black text-[#1935CA] dark:text-[#38BDF8]">
              {calculatedPercentile}th <span className="text-xs font-semibold">Percentile</span>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
            <div className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 tracking-wider">
              Proficiency
            </div>
            <div className="text-base font-black text-amber-700 dark:text-amber-400">
              {calculatedTier}
            </div>
          </div>
        </div>
      </div>

      {/* Trajectory SVG */}
      <div className="relative w-full overflow-x-auto pb-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none overflow-visible">
          <defs>
            <linearGradient id="confidenceRibbonGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1935CA" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#1935CA" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {/* Reference Grid Lines */}
          {[-2.0, -1.0, 0.0, 1.0, 2.0].map((gridTheta) => {
            const y = getY(gridTheta);
            const isZero = gridTheta === 0.0;
            return (
              <g key={gridTheta}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + innerWidth}
                  y2={y}
                  stroke={isZero ? '#94A3B8' : '#E2E8F0'}
                  strokeDasharray={isZero ? '0' : '4 4'}
                  strokeWidth={isZero ? '1.5' : '1'}
                  className="dark:stroke-slate-700"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="text-[10px] font-mono fill-slate-400 dark:fill-slate-500"
                >
                  {gridTheta > 0 ? `+${gridTheta.toFixed(1)}` : gridTheta.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Confidence Error Band */}
          <path d={ribbonPath} fill="url(#confidenceRibbonGrad)" />

          {/* Trajectory Line */}
          <polyline
            fill="none"
            stroke="#1935CA"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pointsString}
            className="dark:stroke-[#38BDF8]"
          />

          {/* Data Points */}
          {trajectory.map((pt, idx) => {
            const x = getX(idx);
            const y = getY(pt.theta);
            const isSelected = selectedPointIndex === idx;

            return (
              <g
                key={pt.step}
                className="cursor-pointer group"
                onClick={() => setSelectedPointIndex(idx)}
              >
                {/* Outer halo if selected */}
                {isSelected && (
                  <circle
                    cx={x}
                    cy={y}
                    r="10"
                    fill="#1935CA"
                    fillOpacity="0.2"
                    className="dark:fill-[#38BDF8]"
                  />
                )}

                {/* Point Node */}
                <circle
                  cx={x}
                  cy={y}
                  r="6"
                  fill={pt.isCorrect ? '#10B981' : '#EF4444'}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  className="transition-transform group-hover:scale-125 dark:stroke-slate-900"
                />

                {/* Step label on X-axis */}
                <text
                  x={x}
                  y={height - padding.bottom + 18}
                  textAnchor="middle"
                  className={`text-[10px] font-bold ${
                    isSelected
                      ? 'fill-[#1935CA] dark:fill-[#38BDF8] font-black'
                      : 'fill-slate-400 dark:fill-slate-500'
                  }`}
                >
                  Q{pt.step}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Step Inspection Card */}
      {selectedPoint && (
        <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                Step {selectedPoint.step} Analysis:
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                  selectedPoint.isCorrect
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                }`}
              >
                {selectedPoint.isCorrect ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" /> Correct
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3" /> Incorrect
                  </>
                )}
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Difficulty Tier: <strong className="capitalize">{selectedPoint.difficultyTier}</strong> (b = {selectedPoint.difficultyParam?.toFixed(2) ?? '0.00'})
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-500 dark:text-slate-400">Updated Ability:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {selectedPoint.theta >= 0 ? `+${selectedPoint.theta.toFixed(2)}` : selectedPoint.theta.toFixed(2)} θ
              </span>
              <span className="text-slate-400 text-[10px]">(SE ± {selectedPoint.standardError.toFixed(2)})</span>
            </div>
          </div>

          {selectedPoint.questionText && (
            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Question: </span>
              {selectedPoint.questionText}
            </p>
          )}
        </div>
      )}

      {/* Explanation Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>Correct Response (Escalates Ability)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            <span>Incorrect Response (De-escalates Ability)</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#1935CA] dark:text-[#38BDF8]" />
          <span>Maximum Fisher Information Convergence</span>
        </div>
      </div>
    </div>
  );
}
