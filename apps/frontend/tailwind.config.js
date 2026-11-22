/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#F8F9FC',
        'dark-canvas': '#0B0F19',
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F1F5F9',
          dark: '#151C2C',
          'dark-muted': '#1E293B',
        },
        brand: {
          primary: '#1935CA',
          hover: '#142BA3',
          light: '#2546F0',
          tint: '#EEF2FF',
          cyan: '#38BDF8',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Poppins', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 10px 30px rgba(25, 53, 202, 0.05)',
        'card-hover': '0 16px 36px rgba(25, 53, 202, 0.09)',
        input: '0 4px 16px rgba(15, 23, 42, 0.05)',
        button: '0 8px 20px rgba(25, 53, 202, 0.22)',
      },
      borderRadius: {
        card: '20px',
      },
    },
  },
  plugins: [],
};
