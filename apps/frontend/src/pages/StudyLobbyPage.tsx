import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { CreateStudyRoomModal } from '../components/study-room/CreateStudyRoomModal';
import { apiClient } from '../api/client';
import { StudyRoomDto } from '@quiz-forge/shared';
import {
  Users,
  Plus,
  ArrowRight,
  BookOpen,
  Radio,
  Search,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

export const StudyLobbyPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeRooms, setActiveRooms] = useState<StudyRoomDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const fetchRooms = () => {
    setIsLoading(true);
    apiClient
      .get<{ success: boolean; data: StudyRoomDto[] }>('/api/study-rooms/active')
      .then((res) => {
        setActiveRooms(res.data || []);
      })
      .catch(() => {
        setActiveRooms([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = joinCode.trim().toUpperCase();
    if (clean.length >= 4) {
      navigate(`/study/${clean}`);
    }
  };

  const filteredRooms = activeRooms.filter((r) =>
    r.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (r.hostName && r.hostName.toLowerCase().includes(searchFilter.toLowerCase())) ||
    r.code.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-blue-700 via-indigo-700 to-blue-900 p-8 md:p-10 text-white shadow-xl">
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-blue-200 border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Multi-Peer Whiteboard & Synchronized Quizzes</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Collaborative Study Rooms
            </h1>
            <p className="text-sm sm:text-base text-blue-100/90 leading-relaxed">
              Study together in real-time. Draw diagrams, solve complex questions synchronously on an
              interactive canvas whiteboard, and communicate with crystal clear audio.
            </p>

            {/* Quick Actions Row */}
            <div className="flex flex-wrap items-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center space-x-2 px-5 py-3 rounded-2xl bg-white text-blue-700 hover:bg-blue-50 font-bold text-sm shadow-lg shadow-black/10 transition active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Create Study Room</span>
              </button>

              {/* Quick Join By Code */}
              <form onSubmit={handleJoinByCode} className="flex items-center space-x-2">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-char Code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="w-40 sm:w-48 px-4 py-3 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 text-white placeholder-blue-200/70 text-sm font-mono uppercase tracking-wider focus:outline-hidden focus:ring-2 focus:ring-white"
                />
                <button
                  type="submit"
                  disabled={joinCode.trim().length < 4}
                  className="flex items-center space-x-1.5 px-4 py-3 rounded-2xl bg-blue-600/80 hover:bg-blue-600 text-white font-semibold text-sm border border-white/20 disabled:opacity-40 transition"
                >
                  <span>Join</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>

          {/* Decorative background blurbs */}
          <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute right-20 top-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* Active Rooms Listing */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <span>Active Study Rooms</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                  {filteredRooms.length}
                </span>
              </h2>
              <button
                type="button"
                onClick={fetchRooms}
                title="Refresh rooms"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Filter */}
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search rooms or hosts..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {filteredRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                No Active Study Rooms
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-5">
                There are no open study groups at the moment. Create a new room to start studying with
                peers or classmates!
              </p>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Room</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRooms.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col justify-between p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-blue-500/40 hover:shadow-md transition-all group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        <Radio className="w-2.5 h-2.5 animate-pulse" />
                        <span>Live</span>
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-400 group-hover:text-blue-600 transition">
                        #{r.code}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition line-clamp-1">
                        {r.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Hosted by <span className="font-semibold text-slate-700 dark:text-slate-300">{r.hostName}</span>
                      </p>
                    </div>

                    {r.quizTitle && (
                      <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-medium">
                        <BookOpen className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{r.quizTitle}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      <span>{r.activeParticipantsCount || 0} / {r.maxParticipants} peers</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/study/${r.code}`)}
                      className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-xs"
                    >
                      <span>Join</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateStudyRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          fetchRooms();
        }}
      />
    </AppLayout>
  );
};
