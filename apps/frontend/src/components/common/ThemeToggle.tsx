import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function ThemeToggle({ className = '', size = 'md' }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const isSmall = size === 'sm';
  const trackWidth = isSmall ? 'w-13 h-7' : 'w-15 h-8';
  const knobSize = isSmall ? 'w-5 h-5' : 'w-6 h-6';
  const knobTranslate = isSmall
    ? (isDark ? 'translate-x-6' : 'translate-x-1')
    : (isDark ? 'translate-x-7' : 'translate-x-1');
  const iconSize = isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
      className={`relative inline-flex items-center ${trackWidth} rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1935CA] dark:focus-visible:ring-[#38BDF8] active:scale-95 cursor-pointer shadow-inner select-none p-1 shrink-0 ${
        isDark
          ? 'bg-[#151C2C] border border-slate-700/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]'
          : 'bg-[#EEF2FF] border border-slate-200/90 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]'
      } ${className}`}
    >
      {/* Background Track Icons */}
      <span
        className={`absolute left-2 flex items-center justify-center text-amber-500 transition-all duration-300 ${
          isDark ? 'opacity-0 scale-50 -rotate-90' : 'opacity-100 scale-100 rotate-0'
        } pointer-events-none`}
      >
        <Sun className={iconSize} />
      </span>

      <span
        className={`absolute right-2 flex items-center justify-center text-[#38BDF8] transition-all duration-300 ${
          isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 rotate-90'
        } pointer-events-none`}
      >
        <Moon className={iconSize} />
      </span>

      {/* Animated Sliding Knob */}
      <span
        className={`pointer-events-none inline-flex items-center justify-center ${knobSize} rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform ${knobTranslate} ${
          isDark
            ? 'bg-[#0B0F19] text-[#38BDF8] shadow-[0_2px_8px_rgba(0,0,0,0.6)] border border-slate-700'
            : 'bg-white text-amber-500 shadow-[0_2px_6px_rgba(0,0,0,0.18)] border border-slate-100'
        }`}
      >
        {isDark ? (
          <Moon className={`${iconSize} -rotate-12 transition-transform duration-300`} />
        ) : (
          <Sun className={`${iconSize} rotate-0 transition-transform duration-300`} />
        )}
      </span>
    </button>
  );
}
