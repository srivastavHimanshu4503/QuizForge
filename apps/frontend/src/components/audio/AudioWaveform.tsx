interface AudioWaveformProps {
  isSpeaking: boolean;
  className?: string;
}

export function AudioWaveform({ isSpeaking, className = '' }: AudioWaveformProps) {
  return (
    <div
      aria-hidden="true"
      className={`flex items-center gap-0.5 h-4 px-1 ${className}`}
    >
      <span
        className={`w-0.5 rounded-full bg-current transition-all duration-300 ${
          isSpeaking ? 'h-3.5 animate-pulse' : 'h-1 opacity-40'
        }`}
        style={{ animationDelay: '0ms' }}
      />
      <span
        className={`w-0.5 rounded-full bg-current transition-all duration-300 ${
          isSpeaking ? 'h-4 animate-pulse' : 'h-1.5 opacity-40'
        }`}
        style={{ animationDelay: '150ms' }}
      />
      <span
        className={`w-0.5 rounded-full bg-current transition-all duration-300 ${
          isSpeaking ? 'h-2.5 animate-pulse' : 'h-1 opacity-40'
        }`}
        style={{ animationDelay: '300ms' }}
      />
      <span
        className={`w-0.5 rounded-full bg-current transition-all duration-300 ${
          isSpeaking ? 'h-3.5 animate-pulse' : 'h-1.5 opacity-40'
        }`}
        style={{ animationDelay: '200ms' }}
      />
    </div>
  );
}
