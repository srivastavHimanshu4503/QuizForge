import {
  AudioTutorPreferences,
  matchVoiceCommand,
  VoiceCommandResult,
} from '@quiz-forge/shared';

// SpeechRecognition type definition for browser environments
interface IWindowSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => IWindowSpeechRecognition;
    webkitSpeechRecognition?: new () => IWindowSpeechRecognition;
  }
}

export class AudioTutorService {
  private synth: SpeechSynthesis | null = null;
  private recognition: IWindowSpeechRecognition | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  isSpeechSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  getCurrentUtterance(): SpeechSynthesisUtterance | null {
    return this.currentUtterance;
  }

  isRecognitionSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      (Boolean(window.SpeechRecognition) || Boolean(window.webkitSpeechRecognition))
    );
  }

  getVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }

  speak(
    text: string,
    prefs: AudioTutorPreferences,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (error: unknown) => void
  ): void {
    if (!this.synth) {
      onError?.(new Error('Speech synthesis is not supported in this browser.'));
      return;
    }

    // Cancel any ongoing speech before starting new utterance
    this.stop();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = prefs.speechRate;
    utterance.pitch = prefs.speechPitch;

    if (prefs.preferredVoiceName) {
      const voices = this.getVoices();
      const chosenVoice = voices.find((v) => v.name === prefs.preferredVoiceName);
      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }
    }

    utterance.onstart = () => {
      onStart?.();
    };

    utterance.onend = () => {
      this.currentUtterance = null;
      onEnd?.();
    };

    utterance.onerror = (e) => {
      this.currentUtterance = null;
      onError?.(e);
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  pause(): void {
    if (this.synth && this.synth.speaking && !this.synth.paused) {
      this.synth.pause();
    }
  }

  resume(): void {
    if (this.synth && this.synth.paused) {
      this.synth.resume();
    }
  }

  stop(): void {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }

  startRecognition(
    onResult: (result: VoiceCommandResult) => void,
    onTranscriptInterim?: (transcript: string) => void,
    onError?: (err: unknown) => void,
    onEnd?: () => void
  ): () => void {
    if (!this.isRecognitionSupported()) {
      onError?.(new Error('Speech recognition is not supported in this browser.'));
      return () => {};
    }

    try {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRec) return () => {};

      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalTranscript += res[0].transcript;
          } else {
            interimTranscript += res[0].transcript;
          }
        }

        if (interimTranscript) {
          onTranscriptInterim?.(interimTranscript);
        }

        if (finalTranscript) {
          const command = matchVoiceCommand(finalTranscript);
          onResult(command);
        }
      };

      rec.onerror = (err: any) => {
        onError?.(err);
      };

      rec.onend = () => {
        this.recognition = null;
        onEnd?.();
      };

      this.recognition = rec;
      rec.start();

      return () => {
        try {
          rec.abort();
        } catch {
          // ignore already stopped
        }
        this.recognition = null;
      };
    } catch (err) {
      onError?.(err);
      return () => {};
    }
  }

  stopRecognition(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
  }
}

export const audioTutorService = new AudioTutorService();
