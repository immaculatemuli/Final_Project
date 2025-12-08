/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#0f172a', // slate-900
          light: '#1e293b',   // slate-800
        },
        surface: {
          DEFAULT: '#1e293b', // slate-800
          light: '#334155',   // slate-700
        },
        primary: {
          DEFAULT: '#3b82f6', // blue-500
          dark: '#2563eb',    // blue-600
          light: '#60a5fa',   // blue-400
        },
        accent: {
          DEFAULT: '#38bdf8', // sky-400
          dark: '#0ea5e9',    // sky-600
        },
        muted: {
          DEFAULT: '#64748b', // slate-500
          light: '#94a3b8',   // slate-400
        },
        error: {
          DEFAULT: '#f43f5e', // rose-500
        },
        warning: {
          DEFAULT: '#fbbf24', // amber-400
        },
        success: {
          DEFAULT: '#10b981', // emerald-500
        },
      },
    },
  },
  plugins: [],
};
