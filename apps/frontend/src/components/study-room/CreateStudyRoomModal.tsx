import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { StudyRoomDto } from '@quiz-forge/shared';
import {
  X,
  Users,
  BookOpen,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface CreateStudyRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserQuiz {
  id: string;
  topic: string;
  questionCount: number;
}

export const CreateStudyRoomModal: React.FC<CreateStudyRoomModalProps> = ({
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [userQuizzes, setUserQuizzes] = useState<UserQuiz[]>([]);
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setIsLoadingQuizzes(true);

    apiClient
      .get<{ data: Array<{ id: string; topic: string; questionCount: number }> }>('/api/quizzes')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setUserQuizzes(list);
      })
      .catch(() => {
        setUserQuizzes([]);
      })
      .finally(() => {
        setIsLoadingQuizzes(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || title.trim().length < 2) {
      setErrorMessage('Room title must be at least 2 characters.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        title: title.trim(),
        maxParticipants,
        quizId: selectedQuizId || undefined,
      };

      const room = await apiClient.post<StudyRoomDto>(
        '/api/study-rooms',
        payload
      );

      if (room && room.id) {
        onClose();
        navigate(`/study/${room.id}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create study room';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Create Collaborative Study Room
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time interactive canvas whiteboard & peer audio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMessage && (
            <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Room Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={100}
              placeholder="e.g., Organic Chemistry Exam Prep & Reaction Mechanisms"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Max Participants */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Max Capacity
              </label>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                {maxParticipants} participants
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={30}
              step={1}
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(parseInt(e.target.value, 10))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>2 peers</span>
              <span>15 peers</span>
              <span>30 peers</span>
            </div>
          </div>

          {/* Attach Quiz (Optional) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Link Quiz (Optional)
            </label>
            <div className="relative">
              <select
                value={selectedQuizId}
                onChange={(e) => setSelectedQuizId(e.target.value)}
                disabled={isLoadingQuizzes}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No quiz (Open whiteboard canvas only)</option>
                {userQuizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.topic} ({q.questionCount} questions)
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 flex items-center space-x-1">
              <BookOpen className="w-3 h-3 inline text-slate-400 mr-1" />
              <span>Linking a quiz allows all participants to review questions synchronously while drawing.</span>
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20 disabled:opacity-50 transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Launching Room...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Launch Study Room</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
