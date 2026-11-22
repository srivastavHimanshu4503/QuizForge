import { useState, useEffect } from 'react';
import { useAudioTutor } from '../../context/AudioContext';
import { buildSocraticNarrationScript } from '@quiz-forge/shared';
import {
  Volume2,
  Square,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AudioWaveform } from './AudioWaveform';

interface SocraticAudioPlayerProps {
  questionText: string;
  selectedChoiceText?: string;
  correctChoiceText: string;
  isCorrect: boolean;
  explanation: string;
  className?: string;
}

export function SocraticAudioPlayer({
  questionText,
  selectedChoiceText,
  correctChoiceText,
  isCorrect,
  explanation,
  className = '',
}: SocraticAudioPlayerProps) {
  const { preferences, speak, stopSpeaking, isSpeaking } = useAudioTutor();

  const [isPlayingThis, setIsPlayingThis] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [localPace, setLocalPace] = useState<'concise' | 'pedagogical' | 'deep'>(
    preferences.socraticPace || 'pedagogical'
  );

  const script = buildSocraticNarrationScript({
    questionText,
    selectedChoiceText,
    correctChoiceText,
    isCorrect,
    explanation,
    pace: localPace,
  });

  const handleTogglePlay = () => {
    if (isPlayingThis && isSpeaking) {
      stopSpeaking();
      setIsPlayingThis(false);
      return;
    }

    setIsPlayingThis(true);
    speak(script, () => {
      setIsPlayingThis(false);
    });
  };

  useEffect(() => {
    if (!isSpeaking) {
      setIsPlayingThis(false);
    }
  }, [isSpeaking]);

  return (
    <div
      role="region"
      aria-label="Socratic Audio Walkthrough"
      className={`rounded-2xl border p-4 transition-all ${
        isPlayingThis
          ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 shadow-md'
          : 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800'
      } ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isPlayingThis
                ? 'bg-[#1935CA] text-white shadow-md'
                : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400'
            }`}
          >
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Socratic Audio Walkthrough
              </span>
              {isPlayingThis && <AudioWaveform isSpeaking={true} />}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              AI Pedagogical Step-by-Step Explanation
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {/* Depth Selector */}
          <select
            value={localPace}
            onChange={(e) => setLocalPace(e.target.value as any)}
            className="text-[11px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#1935CA]"
            aria-label="Explanation depth"
          >
            <option value="concise">Concise</option>
            <option value="pedagogical">Step-by-Step</option>
            <option value="deep">Deep Reflection</option>
          </select>

          {/* Play/Stop Button */}
          <button
            type="button"
            onClick={handleTogglePlay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
              isPlayingThis
                ? 'bg-rose-500 hover:bg-rose-600 text-white'
                : 'bg-[#1935CA] hover:bg-[#142BA3] text-white'
            }`}
            aria-label={isPlayingThis ? 'Stop audio walkthrough' : 'Listen to audio walkthrough'}
          >
            {isPlayingThis ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>Listen</span>
              </>
            )}
          </button>

          {/* Toggle Transcript */}
          <button
            type="button"
            onClick={() => setShowTranscript((prev) => !prev)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition"
            title={showTranscript ? 'Hide audio transcript' : 'Show audio transcript'}
            aria-expanded={showTranscript}
          >
            {showTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Transcript Accordion */}
      {showTranscript && (
        <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white/70 dark:bg-slate-900/60 p-3 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Audio Script Transcript:
          </span>
          <p className="italic">{script}</p>
        </div>
      )}
    </div>
  );
}
