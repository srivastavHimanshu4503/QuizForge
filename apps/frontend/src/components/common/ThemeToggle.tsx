import { useState, useRef, useEffect } from 'react';
import { useTheme, Theme } from '../../context/ThemeContext';
import { Sun, Moon, Laptop, ChevronDown } from 'lucide-react';

export function ThemeToggle({ showMenu = false }: { showMenu?: boolean }) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!showMenu) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
        title={`Current: ${theme} (${resolvedTheme}). Click to toggle.`}
        className="relative p-2.5 rounded-xl bg-white dark:bg-[#151C2C] text-[#1E293B] dark:text-[#F1F5F9] border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_16px_rgba(15,23,42,0.04)] hover:shadow-md hover:border-[#1935CA] dark:hover:border-[#38BDF8] transition-all group active:scale-95"
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
        ) : (
          <Moon className="w-4 h-4 text-[#1935CA] group-hover:-rotate-12 transition-transform duration-300" />
        )}
      </button>
    );
  }

  const options: { id: Theme; label: string; icon: typeof Sun }[] = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Laptop },
  ];

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Theme options"
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#151C2C] text-[#1E293B] dark:text-[#F1F5F9] border border-slate-200/80 dark:border-slate-800 text-xs font-semibold shadow-sm hover:border-[#1935CA] dark:hover:border-[#38BDF8] transition-all active:scale-95"
      >
        {resolvedTheme === 'dark' ? (
          <Moon className="w-3.5 h-3.5 text-[#38BDF8]" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-500" />
        )}
        <span className="capitalize hidden sm:inline">{theme}</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-800 shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setTheme(opt.id);
                  setIsOpen(false);
                }}
                className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-semibold text-left transition ${
                  isSelected
                    ? 'bg-[#EEF2FF] dark:bg-[#1935CA]/20 text-[#1935CA] dark:text-[#38BDF8]'
                    : 'text-[#696F79] dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#1935CA] dark:text-[#38BDF8]' : ''}`} />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
