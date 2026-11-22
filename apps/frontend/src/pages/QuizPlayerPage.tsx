import { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChoiceId, AdaptiveNextQuestionDto, QuestionDifficultyTier, ClientQuestion } from '@quiz-forge/shared';
import { useQuizAttempt } from '../hooks/useQuizAttempt';
import { useAudioTutor } from '../context/AudioContext';
import { ProgressBar } from '../components/quiz/ProgressBar';
import { OptionCard } from '../components/quiz/OptionCard';
import { QuestionPalette } from '../components/quiz/QuestionPalette';
import { SubmitModal } from '../components/quiz/SubmitModal';
import { AudioWaveform } from '../components/audio/AudioWaveform';
import { AdaptiveAbilityGauge } from '../components/cat/AdaptiveAbilityGauge';
import { apiClient } from '../api/client';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Home,
  Keyboard,
  Clock,
  ShieldAlert,
  ShieldCheck,
  X,
  Volume2,
  Square,
  Mic,
  Target,
} from 'lucide-react';

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
    remainingSeconds,
    tabSwitchCount,
    isTimedOut,
    lastFocusWarning,
    dismissFocusWarning,
    goToQuestion,
    prevQuestion,
    nextQuestion,
    selectOption,
    submitQuiz,
    openSubmitModal,
    closeSubmitModal,
    refetch,
  } = useQuizAttempt(attemptId || '');

  // Milestone 16: Computerized Adaptive Testing (CAT) State
  const [adaptiveStep, setAdaptiveStep] = useState<number>(1);
  const [adaptiveMaxSteps, setAdaptiveMaxSteps] = useState<number>(8);
  const [adaptiveTheta, setAdaptiveTheta] = useState<number>(0.0);
  const [adaptiveSE, setAdaptiveSE] = useState<number>(1.0);
  const [adaptiveTier, setAdaptiveTier] = useState<QuestionDifficultyTier>('medium');
  const [adaptiveQuestion, setAdaptiveQuestion] = useState<ClientQuestion | null>(null);
  const [adaptiveDelta, setAdaptiveDelta] = useState<number | null>(null);
  const [isAdaptiveSubmitting, setIsAdaptiveSubmitting] = useState(false);

  useEffect(() => {
    if (attempt?.isAdaptive && attemptId) {
      void (async () => {
        try {
          const next = await apiClient.get<AdaptiveNextQuestionDto>(
            `/api/attempts/${attemptId}/adaptive-next`
          );
          if (next.isComplete || !next.question) {
            navigate(`/quiz/${attemptId}/results`);
            return;
          }
          setAdaptiveQuestion(next.question);
          setAdaptiveStep(next.step);
          setAdaptiveMaxSteps(next.maxSteps);
          setAdaptiveTheta(next.currentTheta);
          setAdaptiveSE(next.standardError);
          setAdaptiveTier(next.currentDifficultyTier);
        } catch {
          // Graceful fallback
        }
      })();
    }
  }, [attempt?.isAdaptive, attemptId, navigate]);

  const handleAdaptiveSubmit = async () => {
    const q = adaptiveQuestion || currentQuestion;
    if (!q || !attemptId || isAdaptiveSubmitting) return;
    const choice = answers[q.question_id];
    if (!choice) return;

    setIsAdaptiveSubmitting(true);
    try {
      const oldTheta = adaptiveTheta;
      const res = await apiClient.post<{
        isCorrect: boolean;
        newTheta: number;
        newSE: number;
        abilityTier: string;
        step: number;
        isComplete: boolean;
      }>(`/api/attempts/${attemptId}/adaptive-answer`, {
        questionId: q.question_id,
        selectedChoiceId: choice,
      });

      const delta = res.newTheta - oldTheta;
      setAdaptiveDelta(delta);
      setAdaptiveTheta(res.newTheta);
      setAdaptiveSE(res.newSE);

      if (res.isComplete) {
        setTimeout(() => {
          navigate(`/quiz/${attemptId}/results`);
        }, 800);
        return;
      }

      // Fetch next calibrated question
      const next = await apiClient.get<AdaptiveNextQuestionDto>(
        `/api/attempts/${attemptId}/adaptive-next`
      );
      if (next.isComplete || !next.question) {
        setTimeout(() => {
          navigate(`/quiz/${attemptId}/results`);
        }, 800);
        return;
      }

      setAdaptiveQuestion(next.question);
      setAdaptiveStep(next.step);
      setAdaptiveTier(next.currentDifficultyTier);
      setIsAdaptiveSubmitting(false);
    } catch {
      setIsAdaptiveSubmitting(false);
    }
  };

  const activeDisplayQuestion = (attempt?.isAdaptive && adaptiveQuestion) ? adaptiveQuestion : currentQuestion;

  // Milestone 15: AI Voice Narration & Audio Tutor
  const {
    isSupported: isAudioSupported,
    isRecognitionSupported,
    isSpeaking,
    isListening,
    activeTranscript,
    preferences: audioPrefs,
    speak,
    stopSpeaking,
    startVoiceListening,
    stopVoiceListening,
  } = useAudioTutor();

  const handleReadCurrentQuestion = useCallback(() => {
    const q = activeDisplayQuestion;
    if (!q) return;
    if (isSpeaking) {
      stopSpeaking();
      return;
    }

    const choicesText = q.choices
      .map((c) => `Option ${c.choice_id}: ${c.option_text}`)
      .join('. ');
    const stepLabel = attempt?.isAdaptive ? `Adaptive Question ${adaptiveStep}` : `Question ${currentIndex + 1} of ${totalQuestions}`;
    const fullSpeech = `${stepLabel}: ${q.question}. ${choicesText}`;
    speak(fullSpeech);
  }, [activeDisplayQuestion, attempt?.isAdaptive, adaptiveStep, currentIndex, totalQuestions, isSpeaking, speak, stopSpeaking]);

  // Auto-read question on advancement if enabled
  useEffect(() => {
    const q = activeDisplayQuestion;
    if (q && audioPrefs.voiceEnabled && audioPrefs.autoReadQuestion) {
      const choicesText = q.choices
        .map((c) => `Option ${c.choice_id}: ${c.option_text}`)
        .join('. ');
      const stepLabel = attempt?.isAdaptive ? `Adaptive Question ${adaptiveStep}` : `Question ${currentIndex + 1}`;
      const fullSpeech = `${stepLabel}: ${q.question}. ${choicesText}`;
      speak(fullSpeech);
    }
  }, [activeDisplayQuestion?.question_id, audioPrefs.voiceEnabled, audioPrefs.autoReadQuestion, attempt?.isAdaptive, adaptiveStep, currentIndex, speak]);

  // Toggle Hands-Free Voice Control
  const handleToggleVoiceControl = useCallback(() => {
    if (isListening) {
      stopVoiceListening();
      return;
    }

    startVoiceListening((cmd) => {
      const q = activeDisplayQuestion;
      if (cmd.action === 'select_choice' && cmd.choiceId && q) {
        selectOption(q.question_id, cmd.choiceId);
      } else if (cmd.action === 'next_question') {
        if (attempt?.isAdaptive) {
          void handleAdaptiveSubmit();
        } else if (!isLastQuestion) {
          nextQuestion();
        }
      } else if (cmd.action === 'prev_question') {
        if (!isFirstQuestion && !attempt?.isAdaptive) prevQuestion();
      } else if (cmd.action === 'submit_quiz') {
        if (attempt?.isAdaptive) {
          void handleAdaptiveSubmit();
        } else {
          openSubmitModal();
        }
      } else if (cmd.action === 'repeat_question') {
        handleReadCurrentQuestion();
      }
    });
  }, [
    isListening,
    stopVoiceListening,
    startVoiceListening,
    activeDisplayQuestion,
    attempt?.isAdaptive,
    handleAdaptiveSubmit,
    selectOption,
    isLastQuestion,
    nextQuestion,
    isFirstQuestion,
    prevQuestion,
    openSubmitModal,
    handleReadCurrentQuestion,
  ]);

  const handleConfirmSubmit = useCallback(async () => {
    try {
      await submitQuiz();
      navigate(`/quiz/${attemptId}/results`);
    } catch {
      // Error handled in hook
    }
  }, [submitQuiz, navigate, attemptId]);

  // Auto-submit when time expires
  useEffect(() => {
    if (isTimedOut && !isSubmitting) {
      void (async () => {
        try {
          await submitQuiz({ isTimedOut: true });
          navigate(`/quiz/${attemptId}/results?timedOut=true`);
        } catch {
          // Handled
        }
      })();
    }
  }, [isTimedOut, isSubmitting, submitQuiz, navigate, attemptId]);

  const formatTime = (totalSec: number | null): string => {
    if (totalSec === null) return '';
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Keyboard engagement: A/B/C/D to select, Enter to advance/submit, Arrows to navigate, Esc to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Submit modal interaction
      if (isSubmitModalOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeSubmitModal();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          void handleConfirmSubmit();
        }
        return;
      }

      const key = e.key.toUpperCase();

      // Choice selection: A, B, C, D (or 1, 2, 3, 4)
      const choiceMapping: Record<string, ChoiceId> = {
        A: 'A',
        B: 'B',
        C: 'C',
        D: 'D',
        '1': 'A',
        '2': 'B',
        '3': 'C',
        '4': 'D',
      };

      if (choiceMapping[key] && activeDisplayQuestion) {
        const targetChoice = choiceMapping[key];
        const exists = activeDisplayQuestion.choices.some(
          (c) => c.choice_id === targetChoice
        );
        if (exists) {
          e.preventDefault();
          selectOption(activeDisplayQuestion.question_id, targetChoice);
        }
        return;
      }

      // Enter advances to next question or opens review modal on last question
      if (e.key === 'Enter') {
        e.preventDefault();
        if (attempt?.isAdaptive) {
          void handleAdaptiveSubmit();
        } else if (isLastQuestion) {
          openSubmitModal();
        } else {
          nextQuestion();
        }
        return;
      }

      // Arrow navigation
      if (e.key === 'ArrowRight' && !isLastQuestion && !attempt?.isAdaptive) {
        e.preventDefault();
        nextQuestion();
        return;
      }

      if (e.key === 'ArrowLeft' && !isFirstQuestion && !attempt?.isAdaptive) {
        e.preventDefault();
        prevQuestion();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isSubmitModalOpen,
    activeDisplayQuestion,
    attempt?.isAdaptive,
    handleAdaptiveSubmit,
    isLastQuestion,
    isFirstQuestion,
    selectOption,
    nextQuestion,
    prevQuestion,
    openSubmitModal,
    closeSubmitModal,
    handleConfirmSubmit,
  ]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0F19] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-[#1935CA] dark:text-[#38BDF8] animate-spin mb-4" />
        <h2 className="text-xl font-bold text-[#1E293B] dark:text-[#F8FAFC] mb-1">Loading Quiz...</h2>
        <p className="text-sm text-[#696F79] dark:text-slate-400">
          Preparing your questions and previous selections
        </p>
      </div>
    );
  }

  const activeQ = activeDisplayQuestion || currentQuestion;

  if (error || !attempt || !activeQ) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0F19] flex flex-col items-center justify-center p-4 text-center">
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 mb-4 inline-flex">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-[#1E293B] dark:text-[#F8FAFC] mb-2">Quiz Load Error</h2>
        <p className="text-sm text-[#696F79] dark:text-slate-400 max-w-md mb-6">
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
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-[#151C2C] hover:bg-slate-50 dark:hover:bg-slate-800 text-[#1E293B] dark:text-[#F8FAFC] border border-slate-200 dark:border-slate-700 shadow-sm transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const selectedChoice = activeQ ? (answers[activeQ.question_id] ?? null) : null;

  return (
    <div className="min-h-screen bg-[#F8F9FC] dark:bg-[#0B0F19] text-[#1E293B] dark:text-[#F8FAFC] flex flex-col antialiased transition-colors duration-200">
      {/* Header */}
      <header className="border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#151C2C] px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-sm transition-colors duration-200">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 text-xs font-bold text-[#696F79] dark:text-slate-400 hover:text-[#1935CA] dark:hover:text-[#38BDF8] transition"
          >
            <Home className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="text-xs font-bold text-[#1E293B] dark:text-[#F8FAFC] truncate max-w-[150px] sm:max-w-xs">
            {attempt.topic}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Proctored status pill */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-[#696F79] dark:text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Integrity Guard</span>
          </div>

          {/* Countdown Timer */}
          {remainingSeconds !== null && (
            <div
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-bold border transition-colors ${
                remainingSeconds <= 60
                  ? 'bg-rose-50 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 animate-pulse'
                  : remainingSeconds <= 180
                  ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                  : 'bg-[#EEF2FF] dark:bg-slate-800 border-indigo-200 dark:border-slate-700 text-[#1935CA] dark:text-[#38BDF8]'
              }`}
              title="Time remaining for this quiz"
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>{formatTime(remainingSeconds)}</span>
            </div>
          )}

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

      {/* Academic Integrity Alert Banner */}
      {lastFocusWarning && (
        <div className="bg-amber-50 dark:bg-amber-950/70 border-b border-amber-200 dark:border-amber-900 px-4 sm:px-8 py-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between transition">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-semibold">{lastFocusWarning}</span>
            <span className="text-[11px] opacity-80 hidden sm:inline">
              (Total tab switches recorded: {tabSwitchCount})
            </span>
          </div>
          <button
            onClick={dismissFocusWarning}
            className="p-1 rounded text-amber-600 hover:text-amber-800 dark:hover:text-amber-200 transition"
            title="Acknowledge warning"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {attempt.isAdaptive ? (
          <div className="mb-6">
            <AdaptiveAbilityGauge
              theta={adaptiveTheta}
              standardError={adaptiveSE}
              difficultyTier={adaptiveTier}
              delta={adaptiveDelta}
            />
          </div>
        ) : (
          <ProgressBar
            currentIndex={currentIndex}
            totalQuestions={totalQuestions}
            topic={attempt.topic}
            difficulty={attempt.difficulty}
            autosaveStatus={autosaveStatus}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
          {/* Question & Options Column (2 spans) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 rounded-[20px] p-6 sm:p-8 shadow-[0_10px_30px_rgba(25,53,202,0.05)] transition-colors duration-200">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#1935CA] dark:text-[#38BDF8]">
                  {attempt.isAdaptive
                    ? `Adaptive Step ${adaptiveStep} of ${adaptiveMaxSteps}`
                    : `Question ${currentIndex + 1} of ${totalQuestions}`}
                </span>

                {/* Voice Narration & Hands-free Recognition Controls */}
                <div className="flex items-center gap-2">
                  {/* Read Question Audio Button */}
                  {isAudioSupported && (
                    <button
                      type="button"
                      onClick={handleReadCurrentQuestion}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition shadow-sm ${
                        isSpeaking
                          ? 'bg-rose-500 text-white hover:bg-rose-600'
                          : 'bg-indigo-50 dark:bg-indigo-950/60 text-[#1935CA] dark:text-[#38BDF8] hover:bg-indigo-100 dark:hover:bg-indigo-900/40'
                      }`}
                      aria-label={isSpeaking ? 'Stop reading question' : 'Read question aloud'}
                      title={isSpeaking ? 'Stop reading' : 'Read question & options aloud'}
                    >
                      {isSpeaking ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Stop</span>
                          <AudioWaveform isSpeaking={true} />
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Read Aloud</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Hands-Free Voice Answering Mic Button */}
                  {isRecognitionSupported && (
                    <button
                      type="button"
                      onClick={handleToggleVoiceControl}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition shadow-sm ${
                        isListening
                          ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 animate-pulse'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                      aria-label={isListening ? 'Stop listening for voice answer' : 'Answer using voice command'}
                      title={isListening ? 'Listening... say "Option A", "Next", or "Submit"' : 'Click to answer with your voice'}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{isListening ? 'Listening...' : 'Voice Answer'}</span>
                    </button>
                  )}

                  {selectedChoice ? (
                    <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Choice {selectedChoice}
                    </span>
                  ) : (
                    <span className="text-xs text-[#696F79] dark:text-slate-400 font-medium">Unanswered</span>
                  )}
                </div>
              </div>

              {/* Live Voice Transcript Toast / Region */}
              {isListening && activeTranscript && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mb-4 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2"
                >
                  <Mic className="w-3.5 h-3.5 text-amber-600 animate-bounce shrink-0" />
                  <span>
                    Heard: <strong>"{activeTranscript}"</strong>
                  </span>
                </div>
              )}

              <h2 className="text-xl sm:text-2xl font-bold text-[#1E293B] dark:text-[#F8FAFC] leading-snug mb-8">
                {activeQ.question}
              </h2>

              {/* Options */}
              <div className="space-y-3.5">
                {activeQ.choices.map((choice) => (
                  <OptionCard
                    key={choice.choice_id}
                    choiceId={choice.choice_id}
                    optionText={choice.option_text}
                    isSelected={selectedChoice === choice.choice_id}
                    onSelect={() =>
                      selectOption(activeQ.question_id, choice.choice_id)
                    }
                  />
                ))}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-3">
                {attempt.isAdaptive ? (
                  <button
                    type="button"
                    onClick={handleAdaptiveSubmit}
                    disabled={isAdaptiveSubmitting || !selectedChoice}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold bg-[#1935CA] hover:bg-[#142BA3] disabled:opacity-40 text-white shadow-lg shadow-[#1935CA]/20 transition"
                  >
                    {isAdaptiveSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Calibrating Ability θ...</span>
                      </>
                    ) : adaptiveStep >= adaptiveMaxSteps ? (
                      <>
                        <span>Finish Adaptive Assessment</span>
                        <CheckCircle2 className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <span>Submit & Next Question</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={prevQuestion}
                      disabled={isFirstQuestion}
                      className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold bg-white dark:bg-[#151C2C] border border-slate-200 dark:border-slate-700 text-[#1E293B] dark:text-[#F8FAFC] hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
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
                  </>
                )}
              </div>

              {/* Keyboard Shortcut Hints */}
              <div className="hidden md:flex items-center gap-2 text-xs text-[#696F79] dark:text-slate-400">
                <span className="flex items-center gap-1 font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[#1E293B] dark:text-[#F8FAFC]">
                  <kbd className="font-bold text-[#1935CA] dark:text-[#38BDF8]">A-D</kbd> select
                </span>
                <span className="flex items-center gap-1 font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[#1E293B] dark:text-[#F8FAFC]">
                  <kbd className="font-bold text-[#1935CA] dark:text-[#38BDF8]">↵</kbd> {attempt.isAdaptive ? 'calibrate' : isLastQuestion ? 'submit' : 'next'}
                </span>
              </div>
            </div>
          </div>

          {/* Palette Column (1 span) */}
          <div className="space-y-6">
            {attempt.isAdaptive ? (
              <div className="bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 rounded-[20px] p-5 text-xs text-[#696F79] dark:text-slate-400 shadow-[0_10px_30px_rgba(25,53,202,0.05)] space-y-3 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-[#1E293B] dark:text-[#F8FAFC]">
                    <Target className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8]" />
                    <span>CAT Dynamic Engine</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1935CA]/10 text-[#1935CA] dark:text-[#38BDF8]">
                    Step {adaptiveStep}/{adaptiveMaxSteps}
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">Current Ability (θ):</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {adaptiveTheta >= 0 ? `+${adaptiveTheta.toFixed(2)}` : adaptiveTheta.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">Item Selection:</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">Max Fisher Info</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Standard Error:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">± {adaptiveSE.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <QuestionPalette
                questions={attempt.questions}
                currentIndex={currentIndex}
                answers={answers}
                onSelectIndex={goToQuestion}
              />
            )}

            <div className="bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800 rounded-[20px] p-5 text-xs text-[#696F79] dark:text-slate-400 shadow-[0_10px_30px_rgba(25,53,202,0.05)] space-y-3 transition-colors duration-200">
              <div className="flex items-center gap-2 font-bold text-[#1E293B] dark:text-[#F8FAFC]">
                <Keyboard className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8]" />
                <span>Keyboard Shortcuts</span>
              </div>
              <div className="space-y-2 font-medium">
                <div className="flex items-center justify-between">
                  <span>Select Choice</span>
                  <div className="flex gap-1 font-mono text-[11px]">
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#1935CA] dark:text-[#38BDF8] font-bold">A</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#1935CA] dark:text-[#38BDF8] font-bold">B</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#1935CA] dark:text-[#38BDF8] font-bold">C</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#1935CA] dark:text-[#38BDF8] font-bold">D</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>Next / Submit</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#1935CA] dark:text-[#38BDF8] font-mono font-bold text-[11px]">Enter ↵</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span>Prev / Next Question</span>
                  <div className="flex gap-1 font-mono text-[11px]">
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#1935CA] dark:text-[#38BDF8] font-bold">←</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#1935CA] dark:text-[#38BDF8] font-bold">→</kbd>
                  </div>
                </div>
              </div>
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
