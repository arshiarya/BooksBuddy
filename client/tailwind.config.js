/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // BooksBuddy Warm Editorial & Community Palette
        forest: {
          DEFAULT: '#1B4332',
          hover: '#143527',
          dark: '#0F291E',
          light: '#2D5A45',
          50: '#F0F5F2',
          100: '#D8E5DD',
          200: '#B2CCBD',
          500: '#2D5A45',
          600: '#1B4332',
          700: '#143527',
          800: '#0F291E',
          900: '#0A1C14',
        },
        sage: {
          DEFAULT: '#6B8F71',
          hover: '#5B7C60',
          light: '#8EAE93',
          tint: '#EDF6EC',
          border: '#C4D7C8',
        },
        ivory: {
          DEFAULT: '#F6F1E7',
          light: '#FAF7F2',
          dark: '#ECE5D8',
          muted: '#E2D9CC',
        },
        beige: {
          DEFAULT: '#E7D7C1',
          light: '#F4ECE1',
          surface: '#FDFBF7',
          card: '#FAF6EE',
          border: '#DDCFC0',
        },
        terracotta: {
          DEFAULT: '#C97B63',
          hover: '#B56850',
          tint: '#FAF0ED',
          border: '#E8BDB1',
        },
        gold: {
          DEFAULT: '#D4A373',
          light: '#E2BA91',
          tint: '#FAF4ED',
          border: '#E7C8AA',
        },
        charcoal: {
          DEFAULT: '#2E2E2E',
          dark: '#1A1A1A',
          light: '#424242',
        },
        muted: {
          DEFAULT: '#6C6C6C',
          light: '#8A8A8A',
          border: '#D9D0C3',
        },
        // Brand palette mapped to Deep Forest Green for backward compatibility
        brand: {
          50: '#EDF6EC',
          100: '#D8E5DD',
          200: '#B2CCBD',
          300: '#8EAE93',
          400: '#6B8F71',
          500: '#2D5A45',
          600: '#1B4332',
          700: '#143527',
          800: '#0F291E',
          900: '#0A1C14',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Lora', 'Georgia', 'Cambria', 'serif'],
        sans: [
          '"Plus Jakarta Sans"',
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 2px 8px -2px rgba(27, 67, 50, 0.06), 0 1px 4px -1px rgba(27, 67, 50, 0.04)',
        'card-hover': '0 8px 24px -4px rgba(27, 67, 50, 0.10), 0 2px 8px -2px rgba(27, 67, 50, 0.04)',
      },
    },
  },
  plugins: [],
};
