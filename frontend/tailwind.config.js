/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#08090f',
          surface: '#0d1117',
          card: '#111827',
          hover: '#1a2235',
          border: '#1f2937',
        },
        accent: {
          DEFAULT: '#eab308',
          hover: '#f59e0b',
          dim: '#78350f',
          text: '#fef08a',
        },
        text: {
          primary: '#f9fafb',
          muted: '#9ca3af',
          subtle: '#4b5563',
        },
        status: {
          high: '#22c55e',
          medium: '#f59e0b',
          low: '#ef4444',
          info: '#3b82f6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: { card: '12px', btn: '8px' },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(31,41,55,0.8)',
        accent: '0 0 20px rgba(234,179,8,0.2)',
        glow: '0 0 15px rgba(234,179,8,0.12), 0 0 45px rgba(234,179,8,0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.25s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
