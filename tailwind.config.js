/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        specter: {
          darker: '#0a0a0f',
          dark: '#12121a',
          medium: '#1a1a26',
          light: '#252535',
          accent: '#7c3aed',
          'accent-hover': '#8b5cf6',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          info: '#3b82f6',
          critical: '#dc2626',
          high: '#f97316',
          low: '#22c55e',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #7c3aed, 0 0 10px #7c3aed' },
          '100%': { boxShadow: '0 0 10px #7c3aed, 0 0 20px #7c3aed, 0 0 30px #7c3aed' },
        }
      }
    },
  },
  plugins: [],
}
