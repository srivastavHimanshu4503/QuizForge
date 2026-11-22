import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import {
  AudioTutorPreferences,
  audioTutorPreferencesSchema,
  VoiceCommandResult,
} from '@quiz-forge/shared';
import { audioTutorService } from '../lib/audio-tutor';

const PREFS_STORAGE_KEY = 'quizforge_audio_tutor_prefs';

interface AudioContextType {
  isSupported: boolean;
  isRecognitionSupported: boolean;
  isSpeaking: boolean;
  isPaused: boolean;
  isListening: boolean;
  activeTranscript: string;
  preferences: AudioTutorPreferences;
  availableVoices: SpeechSynthesisVoice[];
  updatePreferences: (partial: Partial<AudioTutorPreferences>) => void;
  speak: (text: string, onEnd?: () => void) => void;
  stopSpeaking: () => void;
  pauseSpeaking: () => void;
  resumeSpeaking: () => void;
  startVoiceListening: (onCommand: (cmd: VoiceCommandResult) => void) => void;
  stopVoiceListening: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: ReactNode }) {
  const isSupported = audioTutorService.isSpeechSupported();
  const isRecognitionSupported = audioTutorService.isRecognitionSupported();

  // Load preferences from localStorage
  const [preferences, setPreferences] = useState<AudioTutorPreferences>(() => {
    try {
      const stored = localStorage.getItem(PREFS_STORAGE_KEY);
      if (stored) {
        return audioTutorPreferencesSchema.parse(JSON.parse(stored));
      }
    } catch {
      // fallback to default
    }
    return {
      voiceEnabled: true,
      autoReadQuestion: false,
      speechRate: 1.0,
      speechPitch: 1.0,
      socraticPace: 'pedagogical',
    };
  });

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeTranscript, setActiveTranscript] = useState('');

  // Load available system voices
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const voices = audioTutorService.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
      }
    };

    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [isSupported]);

  // Persist preferences on change
  const updatePreferences = useCallback((partial: Partial<AudioTutorPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore storage quota error
      }
      return updated;
    });
  }, []);

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!isSupported || !preferences.voiceEnabled) return;

      setIsSpeaking(true);
      setIsPaused(false);

      audioTutorService.speak(
        text,
        preferences,
        () => {
          setIsSpeaking(true);
          setIsPaused(false);
        },
        () => {
          setIsSpeaking(false);
          setIsPaused(false);
          onEnd?.();
        },
        () => {
          setIsSpeaking(false);
          setIsPaused(false);
        }
      );
    },
    [isSupported, preferences]
  );

  const stopSpeaking = useCallback(() => {
    audioTutorService.stop();
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  const pauseSpeaking = useCallback(() => {
    audioTutorService.pause();
    setIsPaused(true);
  }, []);

  const resumeSpeaking = useCallback(() => {
    audioTutorService.resume();
    setIsPaused(false);
  }, []);

  const startVoiceListening = useCallback(
    (onCommand: (cmd: VoiceCommandResult) => void) => {
      if (!isRecognitionSupported) return;

      setIsListening(true);
      setActiveTranscript('');

      audioTutorService.startRecognition(
        (cmd) => {
          setActiveTranscript(cmd.rawTranscript);
          onCommand(cmd);
        },
        (interim) => {
          setActiveTranscript(interim);
        },
        () => {
          setIsListening(false);
        },
        () => {
          setIsListening(false);
        }
      );
    },
    [isRecognitionSupported]
  );

  const stopVoiceListening = useCallback(() => {
    audioTutorService.stopRecognition();
    setIsListening(false);
  }, []);

  return (
    <AudioContext.Provider
      value={{
        isSupported,
        isRecognitionSupported,
        isSpeaking,
        isPaused,
        isListening,
        activeTranscript,
        preferences,
        availableVoices,
        updatePreferences,
        speak,
        stopSpeaking,
        pauseSpeaking,
        resumeSpeaking,
        startVoiceListening,
        stopVoiceListening,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudioTutor() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudioTutor must be used within an AudioProvider');
  }
  return context;
}
