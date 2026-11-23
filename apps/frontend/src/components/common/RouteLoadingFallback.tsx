import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

export const RouteLoadingFallback: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-200">
      <div className="w-14 h-14 rounded-2xl bg-[#1935CA]/10 dark:bg-[#38BDF8]/10 text-[#1935CA] dark:text-[#38BDF8] flex items-center justify-center mb-4 shadow-sm">
        <Sparkles className="w-7 h-7 animate-pulse" />
      </div>
      <div className="flex items-center gap-2.5 text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
        <Loader2 className="w-4 h-4 animate-spin text-[#1935CA] dark:text-[#38BDF8]" />
        <span>Loading QuizForge...</span>
      </div>
      <p className="text-xs text-slate-400 font-medium">Preparing application interface</p>
    </div>
  );
};
