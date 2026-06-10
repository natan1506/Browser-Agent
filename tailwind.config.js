/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        page: 'var(--page-bg)',
        surface: 'var(--surface-bg)',
        border: 'var(--border-color)',
        accent: 'var(--accent)',
        'accent-cyan': 'var(--accent-cyan)',
        success: 'var(--success)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'hover-bg': 'var(--hover-bg)',
      },
      keyframes: {
        'slide-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.2s ease-out',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        blink: 'blink 1s step-end infinite',
      },
    },
  },
  plugins: [],
};
