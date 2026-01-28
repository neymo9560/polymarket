/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Couleurs HyperBot/Hyperliquid exactes
        hl: {
          bg: '#0f1a1f',
          card: '#0f1a1f',
          'card-light': '#162027',
          border: '#1e2c33',
          hover: '#1a2930',
          green: '#50d2c1',
          red: '#ff5353',
          blue: '#4c8fff',
          yellow: '#f0b90b',
          purple: '#a855f7',
          cyan: '#50d2c1',
          text: {
            primary: '#ffffff',
            secondary: '#9db2bd',
            muted: '#5e7a87',
          },
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'SF Mono', 'Consolas', 'monospace'],
        sans: ['Inter', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        'xxs': '0.625rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
