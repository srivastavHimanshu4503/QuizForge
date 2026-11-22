import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';

interface SubmitModalProps {
  isOpen: boolean;
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SubmitModal({
  isOpen,
  totalQuestions,
  answeredCount,
  unansweredCount,
  isSubmitting,
  onConfirm,
  onCancel,
}: SubmitModalProps) {
  if (!isOpen) return null;

  const hasUnanswered = unansweredCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-[24px] p-6 sm:p-7 shadow-2xl relative border border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div
            className={`p-3 rounded-2xl ${
              hasUnanswered
                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
            }`}
          >
            {hasUnanswered ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <CheckCircle2 className="w-6 h-6" />
            )}
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-[#1E293B]">Submit Quiz Attempt?</h3>
            <p className="text-xs text-[#696F79] font-medium">
              Your final score and review will be evaluated immediately.
            </p>
          </div>
        </div>

        {/* Summary Card */}
        <div className="my-5 p-4 rounded-2xl bg-[#F8F9FC] border border-slate-200/80 space-y-2.5 text-sm">
          <div className="flex items-center justify-between text-[#696F79] font-medium">
            <span>Total Questions:</span>
            <span className="font-bold text-[#1E293B]">{totalQuestions}</span>
          </div>
          <div className="flex items-center justify-between text-[#696F79] font-medium">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Answered Questions:
            </span>
            <span className="font-bold text-emerald-700">{answeredCount}</span>
          </div>
          <div className="flex items-center justify-between text-[#696F79] font-medium">
            <span className="flex items-center gap-1.5 text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Unanswered Questions:
            </span>
            <span className="font-bold text-amber-700">{unansweredCount}</span>
          </div>

          {hasUnanswered && (
            <p className="pt-2 text-xs text-amber-700 font-semibold border-t border-slate-200">
              ⚠️ Warning: You have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}. Unanswered questions receive 0 points.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-[#696F79] bg-[#F8F9FC] hover:bg-slate-100 hover:text-[#1E293B] border border-slate-200/80 transition disabled:opacity-50"
          >
            Keep Reviewing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-[#1935CA] hover:bg-[#142BA3] shadow-lg shadow-[#1935CA]/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <span>Confirm & Submit</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
