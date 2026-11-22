import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuizAttempt } from '../hooks/useQuizAttempt';
import { ProgressBar } from '../components/quiz/ProgressBar';
import { OptionCard } from '../components/quiz/OptionCard';
import { QuestionPalette } from '../components/quiz/QuestionPalette';
import { SubmitModal } from '../components/quiz/SubmitModal';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, AlertCircle, Home } from 'lucide-react';

export function QuizPlayerPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const {
    attempt,
    currentQuestion,
    currentIndex,
    totalQuestions,
    answers,
    isLoading,
    error,
    autosaveStatus,
    isSubmitting,
    isSubmitModalOpen,
    isFirstQuestion,
    isLastQuestion,
    answeredCount,
    unansweredCount,
    goToQuestion,
    prevQuestion,
    nextQuestion,
    selectOption,
    submitQuiz,
    openSubmitModal,
    closeSubmitModal,
    refetch,
  } = useQuizAttempt(attemptId || '');

  const handleConfirmSubmit = async () => {
    try {
      await submitQuiz();
      navigate(`/quiz/${attemptId}/results`);
    } catch {
      // Error handled in hook
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-[#1935CA] animate-spin mb-4" />
        <h2 className="text-xl font-bold text-[#1E293B] mb-1">Loading Quiz...</h2>
        <p className="text-sm text-[#696F79]">
          Preparing your questions and previous selections
        </p>
      </div>
    );
  }

  if (error || !attempt || !currentQuestion) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] flex flex-col items-center justify-center p-4 text-center">
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 mb-4 inline-flex">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-[#1E293B] mb-2">Quiz Load Error</h2>
        <p className="text-sm text-[#696F79] max-w-md mb-6">
          {error || 'Unable to retrieve quiz attempt.'}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={refetch}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#1935CA] hover:bg-[#142BA3] text-white shadow-lg shadow-[#1935CA]/20 transition"
          >
            Retry Loading
          </button>
          <Link
            to="/"
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-[#1E293B] border border-slate-200 shadow-sm transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const selectedChoice = answers[currentQuestion.question_id] ?? null;

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-[#1E293B] flex flex-col antialiased">
      {/* Header */}
      <header className="border-b border-slate-100 bg-white px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 text-xs font-bold text-[#696F79] hover:text-[#1935CA] transition"
          >
            <Home className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-bold text-[#1E293B] truncate max-w-[200px] sm:max-w-xs">
            {attempt.topic}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openSubmitModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Finish & Submit</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <ProgressBar
          currentIndex={currentIndex}
          totalQuestions={totalQuestions}
          topic={attempt.topic}
          difficulty={attempt.difficulty}
          autosaveStatus={autosaveStatus}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
          {/* Question & Options Column (2 spans) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-100 rounded-[20px] p-6 sm:p-8 shadow-[0_10px_30px_rgba(25,53,202,0.05)]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#1935CA]">
                  Question {currentIndex + 1} of {totalQuestions}
                </span>
                {selectedChoice ? (
                  <span className="text-xs text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Answered (Choice {selectedChoice})
                  </span>
                ) : (
                  <span className="text-xs text-[#696F79] font-medium">Unanswered</span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-[#1E293B] leading-snug mb-8">
                {currentQuestion.question}
              </h2>

              {/* Options */}
              <div className="space-y-3.5">
                {currentQuestion.choices.map((choice) => (
                  <OptionCard
                    key={choice.choice_id}
                    choiceId={choice.choice_id}
                    optionText={choice.option_text}
                    isSelected={selectedChoice === choice.choice_id}
                    onSelect={() =>
                      selectOption(currentQuestion.question_id, choice.choice_id)
                    }
                  />
                ))}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={prevQuestion}
                disabled={isFirstQuestion}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold bg-white border border-slate-200 text-[#1E293B] hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              {isLastQuestion ? (
                <button
                  type="button"
                  onClick={openSubmitModal}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 transition"
                >
                  <span>Review & Submit</span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={nextQuestion}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold bg-[#1935CA] hover:bg-[#142BA3] text-white shadow-lg shadow-[#1935CA]/20 transition"
                >
                  <span>Next Question</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Palette Column (1 span) */}
          <div className="space-y-6">
            <QuestionPalette
              questions={attempt.questions}
              currentIndex={currentIndex}
              answers={answers}
              onSelectIndex={goToQuestion}
            />

            <div className="bg-white border border-slate-100 rounded-[20px] p-5 text-xs text-[#696F79] shadow-[0_10px_30px_rgba(25,53,202,0.05)] space-y-2">
              <p className="font-bold text-[#1E293B]">💡 Tip</p>
              <p className="leading-relaxed font-medium">
                Selections are automatically saved in real-time. You can jump to any question using the palette or navigate with the Previous and Next buttons.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      <SubmitModal
        isOpen={isSubmitModalOpen}
        totalQuestions={totalQuestions}
        answeredCount={answeredCount}
        unansweredCount={unansweredCount}
        isSubmitting={isSubmitting}
        onConfirm={handleConfirmSubmit}
        onCancel={closeSubmitModal}
      />
    </div>
  );
}
