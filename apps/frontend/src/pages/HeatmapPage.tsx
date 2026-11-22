import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { apiClient } from '../api/client';
import {
  StudentHeatmapResponseDto,
  TopicMasteryDto,
  RemedialQuizResponseDto,
} from '@quiz-forge/shared';
import {
  BrainCircuit,
  Sparkles,
  Flame,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Clock,
  Layers,
  ArrowRight,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';

export function HeatmapPage() {
  const navigate = useNavigate();

  const [data, setData] = useState<StudentHeatmapResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Remedial Quiz Generation State
  const [selectedTopic, setSelectedTopic] = useState<string>('auto');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [remedialError, setRemedialError] = useState<string | null>(null);

  // Heatmap Filter: all | gaps | developing | mastered
  const [filter, setFilter] = useState<'all' | 'gap' | 'developing' | 'mastered'>('all');

  const fetchHeatmap = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<StudentHeatmapResponseDto>('/api/analytics/mastery-heatmap');
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load mastery heatmap';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmap();
  }, []);

  const handleGenerateRemedial = async (overrideTopic?: string) => {
    setIsGenerating(true);
    setRemedialError(null);
    try {
      const topicToTarget =
        overrideTopic || (selectedTopic === 'auto' ? undefined : selectedTopic);

      const res = await apiClient.post<RemedialQuizResponseDto>('/api/analytics/remedial-quiz', {
        targetTopic: topicToTarget,
        questionCount,
        difficulty: 'medium',
      });

      // Navigate straight to the quiz player for the new remedial attempt
      navigate(`/quiz/${res.attemptId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate remedial quiz';
      setRemedialError(msg);
      setIsGenerating(false);
    }
  };

  const filteredTopics = (data?.topicHeatmap || []).filter((t: TopicMasteryDto) => {
    if (filter === 'all') return true;
    if (filter === 'gap') return t.masteryLevel === 'gap';
    if (filter === 'developing') return t.masteryLevel === 'developing';
    if (filter === 'mastered') return t.masteryLevel === 'mastered' || t.masteryLevel === 'proficient';
    return true;
  });

  return (
    <AppLayout activeNav="heatmap">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1935CA] to-indigo-600 flex items-center justify-center text-white shadow-md">
                <Flame className="w-5 h-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E293B] dark:text-white tracking-tight">
                Knowledge Matrix & Gap Heatmap
              </h1>
            </div>
            <p className="text-sm text-[#696F79] dark:text-slate-400 mt-1.5">
              Comprehensive topic mastery breakdown, weakness diagnosis, and 1-click targeted AI remediation.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchHeatmap}
            disabled={isLoading}
            className="self-start md:self-auto flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Analytics</span>
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchHeatmap}
              className="text-xs font-bold underline hover:no-underline ml-4"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && !data && (
          <div className="flex flex-col gap-6 animate-pulse">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800" />
              ))}
            </div>
            <div className="h-44 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-80 rounded-2xl bg-slate-200 dark:bg-slate-800" />
          </div>
        )}

        {data && (
          <>
            {/* Top Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Total Attempts */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Attempts</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {data.summary.totalAttempts}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">Completed quizzes</span>
                </div>
              </div>

              {/* Questions Answered */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Questions Answered</span>
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {data.summary.totalQuestionsAnswered}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">Tested concepts</span>
                </div>
              </div>

              {/* Overall Accuracy */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Overall Accuracy</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {data.summary.overallAccuracy}%
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">Across all subjects</span>
                </div>
              </div>

              {/* Mastered Topics */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mastered Topics</span>
                  <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-teal-600 dark:text-teal-400">
                    {data.summary.masteredTopicsCount}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">≥ 85% accuracy</span>
                </div>
              </div>

              {/* Identified Gaps */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Identified Gaps</span>
                  <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                    {data.summary.identifiedGapsCount}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">Require practice</span>
                </div>
              </div>
            </div>

            {/* 1-Click Remedial Quiz Generator Banner */}
            <div className="rounded-3xl bg-gradient-to-br from-[#1935CA] via-indigo-700 to-slate-900 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold uppercase tracking-wider mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>AI Remedial Practice Engine</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                    Close Knowledge Gaps with Targeted Remedial Quizzes
                  </h2>
                  <p className="text-sm text-indigo-100 mt-2 leading-relaxed">
                    Our AI evaluates the specific questions and conceptual explanations you missed in previous attempts. It then generates tailored practice questions designed to solidify your understanding and turn weaknesses into mastery.
                  </p>
                </div>

                {/* Generator Controls */}
                <div className="bg-white/10 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-white/20 flex flex-col gap-3 min-w-[300px]">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-indigo-200 mb-1">
                      Focus Target
                    </label>
                    <select
                      value={selectedTopic}
                      onChange={(e) => setSelectedTopic(e.target.value)}
                      className="w-full bg-slate-900/60 border border-white/20 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="auto">⚡ Auto-target Highest Priority Gap</option>
                      {data.topicHeatmap.map((t) => (
                        <option key={t.topic} value={t.topic}>
                          {t.topic} ({t.accuracyPercentage}% accuracy)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-indigo-200 mb-1">
                      Practice Questions
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[3, 5, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setQuestionCount(num)}
                          className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            questionCount === num
                              ? 'bg-white text-indigo-900 border-white shadow-sm'
                              : 'bg-white/5 border-white/20 text-white hover:bg-white/10'
                          }`}
                        >
                          {num} Qs
                        </button>
                      ))}
                    </div>
                  </div>

                  {remedialError && (
                    <p className="text-[11px] text-rose-300 font-semibold">{remedialError}</p>
                  )}

                  <button
                    type="button"
                    onClick={() => handleGenerateRemedial()}
                    disabled={isGenerating}
                    className="w-full mt-1 bg-white hover:bg-indigo-50 text-[#1935CA] font-extrabold text-xs uppercase tracking-wider py-3 rounded-xl transition-all shadow-lg hover:shadow-indigo-900/40 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-[#1935CA]" />
                        <span>Crafting Remedial Quiz...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span>Generate & Start Remedial Quiz</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Identified Knowledge Gaps Section */}
            {data.knowledgeGaps.length > 0 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Identified Knowledge Gaps ({data.knowledgeGaps.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Targeted based on past incorrect answers
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.knowledgeGaps.map((gap) => (
                    <div
                      key={gap.topic}
                      className="p-5 rounded-2xl bg-white dark:bg-[#151C2C] border border-rose-100 dark:border-rose-950/60 shadow-sm flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span
                              className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mb-1.5 ${
                                gap.priority === 'critical'
                                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60'
                                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60'
                              }`}
                            >
                              {gap.priority === 'critical' ? 'Critical Gap' : 'High Priority'}
                            </span>
                            <h4 className="text-base font-bold text-slate-900 dark:text-white">
                              {gap.topic}
                            </h4>
                          </div>

                          <div className="text-right">
                            <span className="text-xl font-black text-rose-600 dark:text-rose-400 block">
                              {gap.accuracyPercentage}%
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {gap.missedQuestionsCount} missed concept{gap.missedQuestionsCount === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>

                        {/* Sample missed question context */}
                        {gap.sampleMissedQuestions.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Concepts to reinforce:
                            </span>
                            {gap.sampleMissedQuestions.map((q) => (
                              <div
                                key={q.questionId}
                                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 text-xs flex flex-col gap-1"
                              >
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {q.questionText}
                                </span>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                                  💡 {q.explanation}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleGenerateRemedial(gap.topic)}
                        disabled={isGenerating}
                        className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        <span>Remediate {gap.topic}</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Topic Mastery Heatmap Matrix */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Topic Mastery Matrix
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Interactive performance grid across all subjects attempted.
                  </p>
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl self-start">
                  {(
                    [
                      { id: 'all', label: `All (${data.topicHeatmap.length})` },
                      { id: 'gap', label: `Gaps (<50%)` },
                      { id: 'developing', label: `Developing` },
                      { id: 'mastered', label: `Mastered` },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilter(item.id)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                        filter === item.id
                          ? 'bg-white dark:bg-slate-700 text-[#1935CA] dark:text-[#38BDF8] shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredTopics.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800">
                  <BrainCircuit className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                    No Topics Found In This Category
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Take more quizzes to populate this section of your knowledge matrix.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTopics.map((topic) => {
                    const isMastered = topic.masteryLevel === 'mastered';
                    const isProficient = topic.masteryLevel === 'proficient';
                    const isDeveloping = topic.masteryLevel === 'developing';

                    const colorClass = isMastered
                      ? 'border-emerald-200 dark:border-emerald-950/60 bg-emerald-500/5'
                      : isProficient
                      ? 'border-blue-200 dark:border-blue-950/60 bg-blue-500/5'
                      : isDeveloping
                      ? 'border-amber-200 dark:border-amber-950/60 bg-amber-500/5'
                      : 'border-rose-200 dark:border-rose-950/60 bg-rose-500/5';

                    const badgeClass = isMastered
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                      : isProficient
                      ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                      : isDeveloping
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                      : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400';

                    const barClass = isMastered
                      ? 'bg-emerald-500'
                      : isProficient
                      ? 'bg-blue-500'
                      : isDeveloping
                      ? 'bg-amber-500'
                      : 'bg-rose-500';

                    return (
                      <div
                        key={topic.topic}
                        className={`p-5 rounded-2xl bg-white dark:bg-[#151C2C] border ${colorClass} shadow-sm flex flex-col justify-between gap-4 transition-transform hover:-translate-y-0.5`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-2">
                              {topic.topic}
                            </h4>
                            <span
                              className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${badgeClass}`}
                            >
                              {topic.masteryLevel}
                            </span>
                          </div>

                          {/* Accuracy Bar */}
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs font-bold mb-1">
                              <span className="text-slate-500 dark:text-slate-400">Mastery</span>
                              <span className="text-slate-900 dark:text-white">
                                {topic.accuracyPercentage}%
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                                style={{ width: `${topic.accuracyPercentage}%` }}
                              />
                            </div>
                          </div>

                          {/* Metadata */}
                          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                            <span>
                              {topic.correctCount}/{topic.totalQuestions} correct
                            </span>
                            <span>{topic.attemptsCount} attempt{topic.attemptsCount === 1 ? '' : 's'}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleGenerateRemedial(topic.topic)}
                          disabled={isGenerating}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-[#1935CA] hover:text-white dark:hover:bg-[#1935CA] text-slate-700 dark:text-slate-300 text-xs font-bold transition-all disabled:opacity-50 group"
                        >
                          <Sparkles className="w-3 h-3 text-amber-500 group-hover:text-white" />
                          <span>Practice Topic</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cognitive Difficulty Breakdown & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Difficulty Breakdown */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8]" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Cognitive Difficulty Breakdown
                    </h3>
                  </div>

                  <div className="flex flex-col gap-4">
                    {data.difficultyBreakdown.map((d) => (
                      <div key={d.difficulty} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="capitalize text-slate-700 dark:text-slate-300">
                            {d.difficulty}
                          </span>
                          <span className="text-slate-900 dark:text-white">
                            {d.accuracyPercentage}% ({d.correctCount}/{d.totalQuestions})
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              d.difficulty === 'easy'
                                ? 'bg-emerald-500'
                                : d.difficulty === 'medium'
                                ? 'bg-blue-500'
                                : 'bg-indigo-600'
                            }`}
                            style={{ width: `${d.accuracyPercentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                  Track your mastery across varying complexity levels from foundational to advanced.
                </p>
              </div>

              {/* Recent Quiz Activity Feed */}
              <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#1935CA] dark:text-[#38BDF8]" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Recent Quiz Attempts
                      </h3>
                    </div>
                    <Link
                      to="/history"
                      className="text-xs font-bold text-[#1935CA] dark:text-[#38BDF8] hover:underline"
                    >
                      View All History
                    </Link>
                  </div>

                  {data.recentActivity.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No completed quiz attempts recorded yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.recentActivity.map((act) => (
                        <div
                          key={act.attemptId}
                          className="py-3 flex items-center justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-white text-xs truncate block">
                              {act.topic}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] uppercase font-bold text-slate-400">
                                {act.difficulty}
                              </span>
                              <span className="text-[10px] text-slate-400">•</span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(act.completedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span
                              className={`text-xs font-black px-2 py-0.5 rounded-md ${
                                act.accuracyPercentage >= 70
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {act.accuracyPercentage}%
                            </span>
                            <Link
                              to={`/quiz/${act.attemptId}/results`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#1935CA] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="View Result Breakdown"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
