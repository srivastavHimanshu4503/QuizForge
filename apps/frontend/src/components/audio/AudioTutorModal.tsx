import { useEffect } from 'react';
import { useAudioTutor } from '../../context/AudioContext';
import {
  Volume2,
  VolumeX,
  Mic,
  X,
  Play,
  Square,
} from 'lucide-react';
import { AudioWaveform } from './AudioWaveform';

interface AudioTutorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AudioTutorModal({ isOpen, onClose }: AudioTutorModalProps) {
  const {
    isSupported,
    preferences,
    updatePreferences,
    availableVoices,
    speak,
    stopSpeaking,
    isSpeaking,
  } = useAudioTutor();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleTestVoice = () => {
    if (isSpeaking) {
      stopSpeaking();
      return;
    }

    speak(
      'Hello! I am your QuizForge AI voice tutor. I narrate questions, listen to your spoken answers, and guide you through step-by-step Socratic explanations.'
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#151C2C] rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 flex flex-col gap-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1935CA] text-white flex items-center justify-center shadow-md">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="audio-modal-title"
                className="text-lg font-extrabold text-slate-900 dark:text-white"
              >
                AI Voice Tutor & Audio Settings
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Text-to-speech narration & hands-free voice controls
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Browser Support Check */}
        {!isSupported && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5">
            <VolumeX className="w-4 h-4 shrink-0" />
            <span>
              Your browser does not support the Web Speech API. Voice narration may not be available.
            </span>
          </div>
        )}

        <div className="space-y-5">
          {/* 1. Master Voice Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  preferences.voiceEnabled
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                }`}
              >
                {preferences.voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Enable Voice Tutor
                </span>
                <span className="text-[11px] text-slate-400">
                  Speaks questions, answer options, and audio walkthroughs
                </span>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={preferences.voiceEnabled}
              onClick={() => updatePreferences({ voiceEnabled: !preferences.voiceEnabled })}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                preferences.voiceEnabled ? 'bg-[#1935CA]' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                  preferences.voiceEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 2. Auto-read Questions Switch */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Auto-Read Questions
              </span>
              <span className="text-[11px] text-slate-400">
                Automatically narrates each new question when navigating
              </span>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={preferences.autoReadQuestion}
              disabled={!preferences.voiceEnabled}
              onClick={() => updatePreferences({ autoReadQuestion: !preferences.autoReadQuestion })}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out disabled:opacity-40 ${
                preferences.autoReadQuestion ? 'bg-[#1935CA]' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                  preferences.autoReadQuestion ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 3. Voice Selection */}
          {availableVoices.length > 0 && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Narrator Voice
              </label>
              <select
                value={preferences.preferredVoiceName || ''}
                disabled={!preferences.voiceEnabled}
                onChange={(e) => updatePreferences({ preferredVoiceName: e.target.value || undefined })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1935CA] disabled:opacity-40"
              >
                <option value="">Default System Voice</option>
                {availableVoices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 4. Speech Speed */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Narration Speed
              </label>
              <span className="text-xs font-black text-[#1935CA] dark:text-[#38BDF8]">
                {preferences.speechRate}x
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[0.75, 1.0, 1.25, 1.5].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  disabled={!preferences.voiceEnabled}
                  onClick={() => updatePreferences({ speechRate: rate })}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all disabled:opacity-40 ${
                    preferences.speechRate === rate
                      ? 'bg-[#1935CA] text-white border-[#1935CA] shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* 5. Socratic Pedagogical Pace */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Socratic Explanation Depth
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'concise', label: 'Concise' },
                  { id: 'pedagogical', label: 'Step-by-Step' },
                  { id: 'deep', label: 'Deep Reflection' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  disabled={!preferences.voiceEnabled}
                  onClick={() => updatePreferences({ socraticPace: mode.id })}
                  className={`py-2 px-1 text-center text-xs font-bold rounded-xl border transition-all disabled:opacity-40 ${
                    preferences.socraticPace === mode.id
                      ? 'bg-[#1935CA] text-white border-[#1935CA] shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Speech Recognition / Voice Commands Note */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 flex items-start gap-3">
            <Mic className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              <span className="font-bold text-indigo-950 dark:text-indigo-200 block mb-0.5">
                Hands-Free Voice Answering Supported
              </span>
              Click the microphone button during quizzes and say{' '}
              <strong className="text-[#1935CA] dark:text-[#38BDF8]">"Option A"</strong>,{' '}
              <strong className="text-[#1935CA] dark:text-[#38BDF8]">"Next"</strong>, or{' '}
              <strong className="text-[#1935CA] dark:text-[#38BDF8]">"Submit"</strong> to take quizzes completely hands-free!
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={!preferences.voiceEnabled}
            onClick={handleTestVoice}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-40"
          >
            {isSpeaking ? (
              <>
                <Square className="w-3.5 h-3.5 text-rose-500 fill-current" />
                <span>Stop Preview</span>
                <AudioWaveform isSpeaking={true} />
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-500 fill-current" />
                <span>Test Voice Narration</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#1935CA] text-white text-xs font-bold hover:bg-[#142BA3] transition shadow-md shadow-indigo-900/20"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
