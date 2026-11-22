import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon, Sparkles } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function ThemeToggle({ className = '', size = 'md' }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const isSmall = size === 'sm';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
      className={`relative inline-flex items-center ${
        isSmall ? 'w-12 h-6 p-0.5' : 'w-14 h-7 p-1'
      } rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1935CA] dark:focus-visible:ring-[#38BDF8] active:scale-95 cursor-pointer shadow-inner select-none shrink-0 overflow-hidden ${
        isDark
          ? 'bg-gradient-to-r from-[#0F172A] to-[#1E293B] border border-slate-700/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]'
          : 'bg-gradient-to-r from-amber-100/90 via-sky-100/70 to-indigo-100/90 border border-slate-200/90 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]'
      } ${className}`}
    >
      {/* Background Track Ambient Decorators (Fade in / Fade out) */}
      <span
        aria-hidden="true"
        className={`absolute left-1.5 flex items-center justify-center transition-all duration-300 pointer-events-none ${
          isDark
            ? 'opacity-0 -translate-x-2 scale-50'
            : 'opacity-100 translate-x-0 scale-100 text-amber-500'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
      </span>

      <span
        aria-hidden="true"
        className={`absolute right-1.5 flex items-center justify-center transition-all duration-300 pointer-events-none ${
          isDark
            ? 'opacity-100 translate-x-0 scale-100 text-[#38BDF8]'
            : 'opacity-0 translate-x-2 scale-50'
        }`}
      >
        <Sparkles className="w-2.5 h-2.5 text-sky-400 animate-pulse" />
      </span>

      {/* Animated Sliding Knob */}
      <span
        className={`pointer-events-none relative inline-flex items-center justify-center ${
          isSmall ? 'w-5 h-5' : 'w-5 h-5'
        } rounded-full transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform ${
          isSmall
            ? isDark
              ? 'translate-x-6'
              : 'translate-x-0'
            : isDark
            ? 'translate-x-7'
            : 'translate-x-0'
        } ${
          isDark
            ? 'bg-[#0B0F19] text-[#38BDF8] shadow-[0_2px_8px_rgba(0,0,0,0.6)] border border-slate-700'
            : 'bg-white text-amber-500 shadow-[0_2px_6px_rgba(245,158,11,0.22)] border border-amber-100'
        }`}
      >
        {/* Sun Icon: Fades out, rotates, scales down when going Dark */}
        <Sun
          className={`w-3.5 h-3.5 text-amber-500 absolute inset-0 m-auto transition-all duration-300 ease-in-out ${
            isDark
              ? 'opacity-0 scale-40 rotate-90 pointer-events-none'
              : 'opacity-100 scale-100 rotate-0'
          }`}
        />

        {/* Moon Icon: Fades in, rotates, scales up when going Dark */}
        <Moon
          className={`w-3.5 h-3.5 text-[#38BDF8] absolute inset-0 m-auto transition-all duration-300 ease-in-out ${
            isDark
              ? 'opacity-100 scale-100 rotate-0'
              : 'opacity-0 scale-40 -rotate-90 pointer-events-none'
          }`}
        />
      </span>
    </button>
  );
}
