import { useState } from 'react';
import { Package, Download, X, Sliders, Loader2, AlertCircle, FileText, Globe } from 'lucide-react';
import { ScormVersion } from '@quiz-forge/shared';

interface ScormExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizId: string;
  quizTitle: string;
}

export function ScormExportModal({
  isOpen,
  onClose,
  quizId,
  quizTitle,
}: ScormExportModalProps) {
  const [version, setVersion] = useState<ScormVersion>('1.2');
  const [passingScore, setPassingScore] = useState<number>(70);
  const [masteryStatus, setMasteryStatus] = useState<'passed' | 'completed'>('passed');
  const [includeExplanations, setIncludeExplanations] = useState<boolean>(true);
  const [trackInteractions, setTrackInteractions] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownload = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        version,
        passingScore: passingScore.toString(),
        masteryStatus,
        includeExplanations: includeExplanations.toString(),
        trackInteractions: trackInteractions.toString(),
      });

      const res = await fetch(`/api/quizzes/${quizId}/export/scorm?${queryParams.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || 'Failed to export SCORM bundle.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = quizTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `QuizForge-SCORM-${version}-${safeTitle}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred during SCORM export.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-50/50 via-indigo-50/20 to-transparent dark:from-slate-800/40 dark:via-slate-800/10 dark:to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1935CA] text-white flex items-center justify-center shadow-md shadow-[#1935CA]/25">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Export SCORM / xAPI Package
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#1935CA]/10 text-[#1935CA] dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]">
                  LMS Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Package this assessment for Canvas, Moodle, Blackboard, or TalentLMS.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* SCORM Standard Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              LMS Standard Specification
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: '1.2', name: 'SCORM 1.2', desc: 'Universally compatible' },
                { id: '2004_4th', name: 'SCORM 2004', desc: '4th Edition scaled scoring' },
                { id: 'xapi', name: 'xAPI (Tin Can)', desc: 'Next-gen learning analytics' },
              ].map((std) => (
                <button
                  key={std.id}
                  type="button"
                  onClick={() => setVersion(std.id as ScormVersion)}
                  className={`p-3 rounded-2xl border text-left transition ${
                    version === std.id
                      ? 'border-[#1935CA] dark:border-[#38BDF8] bg-[#EEF2FF] dark:bg-slate-800/90 text-slate-900 dark:text-white ring-1 ring-[#1935CA] dark:ring-[#38BDF8]'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold">{std.name}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{std.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Configuration Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Passing Score */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#1935CA] dark:text-[#38BDF8]" />
                  Passing Score
                </span>
                <span className="font-mono text-[#1935CA] dark:text-[#38BDF8]">{passingScore}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#1935CA]"
              />
              <p className="text-[10px] text-slate-400">Score required for LMS 'passed' status.</p>
            </div>

            {/* Mastery Status */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                LMS Success Status
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'passed', label: 'Passed' },
                  { id: 'completed', label: 'Completed' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setMasteryStatus(st.id as any)}
                    className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                      masteryStatus === st.id
                        ? 'bg-[#1935CA] text-white border-[#1935CA]'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">Value transmitted to cmi.core.lesson_status.</p>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-1">
            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Include Explanations in Package</div>
                <div className="text-[11px] text-slate-400">Displays pedagogical explanations on final SCORM review screen.</div>
              </div>
              <input
                type="checkbox"
                checked={includeExplanations}
                onChange={(e) => setIncludeExplanations(e.target.checked)}
                className="w-4 h-4 rounded text-[#1935CA] focus:ring-[#1935CA] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Track Item CMI Interactions</div>
                <div className="text-[11px] text-slate-400">Records individual question responses to cmi.interactions in LMS gradebook.</div>
              </div>
              <input
                type="checkbox"
                checked={trackInteractions}
                onChange={(e) => setTrackInteractions(e.target.checked)}
                className="w-4 h-4 rounded text-[#1935CA] focus:ring-[#1935CA] cursor-pointer"
              />
            </label>
          </div>

          {/* Compatibility Callout */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8]" />
              <span>Offline & iFrame Safe (Zero external assets required)</span>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
              <FileText className="w-3.5 h-3.5" />
              <span>imsmanifest.xml verified</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting}
            className="px-5 py-2.5 rounded-xl bg-[#1935CA] hover:bg-[#142BA3] disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-[#1935CA]/20 transition flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Compiling SCORM Bundle...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download .ZIP Bundle</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
