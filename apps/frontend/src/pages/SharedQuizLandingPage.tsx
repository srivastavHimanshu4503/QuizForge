import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient, ApiError } from '../api/client';
import { QuizMetadata, ClientQuestion } from '@quiz-forge/shared';
import {
  Globe,
  Play,
  Loader2,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function SharedQuizLandingPage() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<QuizMetadata | null>(null);
  const [questions, setQuestions] = useState<ClientQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareCode) return;
    setIsLoading(true);
    apiClient
      .get<{ quiz: QuizMetadata; questions: ClientQuestion[] }>(`/api/quizzes/share/${shareCode}`)
      .then((data) => {
        setQuiz(data.quiz);
        setQuestions(data.questions);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        setIsLoading(false);
        setError(
          err instanceof ApiError
            ? err.message
            : 'The shared quiz was not found or is no longer published.'
        );
      });
  }, [shareCode]);

  const handleStartAttempt = async () => {
    if (!shareCode) return;
    setIsStarting(true);
    setError(null);

    try {
      const data = await apiClient.post<{ attemptId: string; quizId: string }>(
        `/api/quizzes/share/${shareCode}/start`
      );
      navigate(`/quiz/${data.attemptId}`);
    } catch (err: unknown) {
      setIsStarting(false);
      setError(
        err instanceof ApiError ? err.message : 'Failed to launch quiz attempt. Please try again.'
      );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-[#1935CA] animate-spin mb-4" />
        <p className="text-sm font-bold text-[#696F79]">Loading shared assessment...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-[#1E293B] flex flex-col antialiased">
      {/* Top Bar */}
      <header className="border-b border-slate-100 bg-white px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-sm">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#1935CA] flex items-center justify-center text-white">
            <Sparkles className="w-4 h-4 fill-white/20" />
          </div>
          <span className="font-extrabold text-lg text-[#1935CA]">QuizForge</span>
        </Link>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col justify-center">
        {error ? (
          <div className="bg-white border border-slate-100 rounded-[24px] p-8 text-center space-y-4 shadow-[0_10px_30px_rgba(25,53,202,0.05)]">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-[#1E293B]">Quiz Unavailable</h1>
            <p className="text-sm text-[#696F79] font-medium">{error}</p>
          </div>
        ) : (
          quiz && (
            <div className="bg-white border border-slate-100 rounded-[24px] p-8 sm:p-10 shadow-[0_10px_30px_rgba(25,53,202,0.05)] relative overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider w-fit mb-4 border border-emerald-200">
                <Globe className="w-3.5 h-3.5" />
                <span>Public Assessment</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E293B] mb-3 tracking-tight">
                {quiz.topic}
              </h1>

              <p className="text-xs text-[#696F79] mb-8 leading-relaxed font-medium">
                You have been invited to take this assessment. Questions will be presented in a randomized sequence, and your responses will be evaluated server-side upon submission.
              </p>

              {/* Assessment Specs */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="p-3.5 rounded-2xl bg-[#F8F9FC] border border-slate-200/80 text-center">
                  <span className="block text-xs text-[#696F79] font-semibold">Questions</span>
                  <span className="block text-lg font-extrabold text-[#1E293B] mt-0.5">
                    {questions.length}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F8F9FC] border border-slate-200/80 text-center">
                  <span className="block text-xs text-[#696F79] font-semibold">Difficulty</span>
                  <span className="block text-lg font-extrabold text-[#1935CA] capitalize mt-0.5">
                    {quiz.difficulty}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F8F9FC] border border-slate-200/80 text-center">
                  <span className="block text-xs text-[#696F79] font-semibold">Format</span>
                  <span className="block text-lg font-extrabold text-[#1E293B] mt-0.5">
                    MCQ
                  </span>
                </div>
              </div>

              {/* Features list */}
              <div className="space-y-2.5 mb-8 text-xs text-[#696F79] font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Fisher-Yates randomized question sequence</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Comprehensive pedagogical explanations revealed upon completion</span>
                </div>
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-[#1935CA] shrink-0" />
                  <span>Attempt will be recorded to your user profile</span>
                </div>
              </div>

              {/* Start Button */}
              <button
                type="button"
                onClick={handleStartAttempt}
                disabled={isStarting}
                className="w-full py-4 rounded-xl bg-[#1935CA] hover:bg-[#142BA3] disabled:opacity-50 text-white font-bold text-sm shadow-xl shadow-[#1935CA]/20 transition flex items-center justify-center gap-2"
              >
                {isStarting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
                <span>Begin Assessment</span>
              </button>
            </div>
          )
        )}
      </main>
    </div>
  );
}
