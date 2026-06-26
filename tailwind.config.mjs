import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#050505',
        text: '#EAEAEA',
        muted: '#9A9A9A',
        border: '#1B1B1B',
        code: '#101010',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'ui-sans-serif', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        reading: '74ch',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 400ms ease-out both',
      },
    },
  },
  plugins: [typography],
};
