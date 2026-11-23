import React, { useState } from 'react';
import { StudyRoomDto } from '@quiz-forge/shared';
import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  CheckCircle2,
  BookOpen,
  Sparkles,
} from 'lucide-react';

interface StudyQuizViewerProps {
  quizData: StudyRoomDto['quizData'];
  activeQuestionIndex: number;
  onSelectQuestion: (index: number) => void;
  isHost: boolean;
}

export const StudyQuizViewer: React.FC<StudyQuizViewerProps> = ({
  quizData,
  activeQuestionIndex,
  onSelectQuestion,
  isHost,
}) => {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  if (!quizData || !quizData.questions || quizData.questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
          <BookOpen className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          No Quiz Attached to Room
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-1">
          This study room is in open collaboration mode. You can use the Whiteboard to sketch diagrams,
          write notes, and collaborate in real-time.
        </p>
      </div>
    );
  }

  const currentQ = quizData.questions[activeQuestionIndex] || quizData.questions[0]!;
  const totalQuestions = quizData.questions.length;

  const handleNext = () => {
    if (activeQuestionIndex < totalQuestions - 1) {
      onSelectQuestion(activeQuestionIndex + 1);
      setSelectedChoiceId(null);
      setShowExplanation(false);
    }
  };

  const handlePrev = () => {
    if (activeQuestionIndex > 0) {
      onSelectQuestion(activeQuestionIndex - 1);
      setSelectedChoiceId(null);
      setShowExplanation(false);
    }
  };

  const choiceLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Top Header & Navigation */}
      <div className="flex flex-wrap items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md">
              Synchronized Quiz
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {quizData.topic}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mt-1">
            Question {activeQuestionIndex + 1} of {totalQuestions}
          </h2>
        </div>

        {/* Host controls / Question stepper */}
        <div className="flex items-center space-x-2">
          {isHost ? (
            <>
              <button
                type="button"
                onClick={handlePrev}
                disabled={activeQuestionIndex === 0}
                className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center space-x-1">
                {quizData.questions.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onSelectQuestion(idx);
                      setSelectedChoiceId(null);
                      setShowExplanation(false);
                    }}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                      activeQuestionIndex === idx
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleNext}
                disabled={activeQuestionIndex === totalQuestions - 1}
                className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Synced with Host</span>
            </div>
          )}
        </div>
      </div>

      {/* Question Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">
            {currentQ.questionText}
          </p>
        </div>

        {/* Choices */}
        <div className="grid grid-cols-1 gap-3">
          {currentQ.choices.map((c, i) => {
            const isSelected = selectedChoiceId === c.id;
            const letter = choiceLetters[i] || `${i + 1}`;

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedChoiceId(c.id)}
                className={`flex items-center text-left p-4 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-200'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm mr-3 transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {letter}
                </div>
                <span className="flex-1 font-medium">{c.choiceText}</span>
                {isSelected && <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 ml-2" />}
              </button>
            );
          })}
        </div>

        {/* Explanation Toggle */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowExplanation(!showExplanation)}
            className="flex items-center space-x-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <HelpCircle className="w-4 h-4" />
            <span>{showExplanation ? 'Hide Explanation' : 'Show Explanation & Key Takeaways'}</span>
          </button>

          {showExplanation && (
            <div className="mt-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-sm leading-relaxed space-y-2">
              <div className="flex items-center space-x-1.5 font-bold text-amber-800 dark:text-amber-300">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Solution Breakdown</span>
              </div>
              <p>{currentQ.explanation || 'No detailed explanation provided for this question.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
