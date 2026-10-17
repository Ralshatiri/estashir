/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7d233e',
          dark: '#703140',
          50: '#fdf2f4',
          100: '#fbe4e9',
          200: '#f5c5d1',
          300: '#ec9aab',
          400: '#de6a82',
          500: '#cc4361',
          600: '#b32f4c',
          700: '#7d233e',
          800: '#703140',
          900: '#4f1f2c',
        },
        teal: {
          DEFAULT: '#1b4859',
          50: '#eef6f8',
          100: '#d4e8ec',
          200: '#a9d0d9',
          300: '#6fb0bf',
          400: '#3d8fa3',
          500: '#1b4859',
          600: '#163c4a',
          700: '#112f3a',
          800: '#0c2229',
        },
        sand: {
          DEFAULT: '#f4dbaa',
          light: '#f9eed7',
          dark: '#e6c785',
        },
        ink: '#1a1416',
        inkSoft: '#4a3a40',
        surface: '#fbf7f2',
        surfaceAlt: '#f3ece4',
        line: '#e7dccb',
      },
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(26,20,22,0.06), 0 8px 24px rgba(26,20,22,0.06)',
        float: '0 4px 12px rgba(26,20,22,0.08), 0 16px 40px rgba(26,20,22,0.08)',
        glow: '0 0 0 4px rgba(244,219,170,0.35)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      animation: {
        rise: 'rise 0.42s cubic-bezier(0.22,1,0.36,1) both',
        fade: 'fade 0.3s ease both',
      },
    },
  },
  plugins: [],
};
