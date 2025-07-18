import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/**/*.{ts,tsx}',
    '*.{js,ts,jsx,tsx,mdx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: {
          DEFAULT: 'hsl(var(--ring))',
          'golden-beige': '#D0B284',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Custom luxury color palette from your style guide
        'deep-charcoal': '#231F20',
        'golden-beige': '#D0B284',
        'deep-emerald': '#184D37',
        'platinum-grey': '#DCDDCC',
        'highlight-gold': '#D7BF75',
        'antique-bronze': '#928357',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'pulse-gold': {
          '0%, 100%': {
            opacity: '1',
            boxShadow: '0 0 0 0 rgba(215, 191, 117, 0.7)',
          },
          '50%': {
            opacity: '0.8',
            boxShadow: '0 0 0 10px rgba(215, 191, 117, 0)',
          },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        glow: {
          '0%, 100%': {
            textShadow:
              '0 0 5px rgba(215, 191, 117, 0.5), 0 0 10px rgba(215, 191, 117, 0.3), 0 0 15px rgba(215, 191, 117, 0.2)',
          },
          '50%': {
            textShadow:
              '0 0 10px rgba(215, 191, 117, 0.8), 0 0 20px rgba(215, 191, 117, 0.6), 0 0 30px rgba(215, 191, 117, 0.4)',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-gold': 'pulse-gold 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s linear infinite',
        glow: 'glow 2s ease-in-out infinite alternate',
      },
      fontFamily: {
        syne: ['var(--font-syne)'],
        spectral: ['var(--font-spectral)'],
        'jetbrains-mono': ['var(--font-jetbrains-mono)'],
        // Aliases for your custom fonts
        cinzel: ['var(--font-syne)', 'serif'],
        jetbrains: ['var(--font-jetbrains-mono)', 'monospace'],
      },
      boxShadow: {
        goldGlow: '0 0 20px rgba(208, 178, 100, 0.5)',
        'luxury-glow': '0 0 30px rgba(215, 191, 117, 0.3), 0 0 60px rgba(215, 191, 117, 0.1)',
        'emerald-glow': '0 0 20px rgba(24, 77, 55, 0.4)',
        'deep-shadow': '0 25px 50px -12px rgba(35, 31, 32, 0.8)',
        'inner-glow': 'inset 0 2px 4px 0 rgba(215, 191, 117, 0.1)',
      },
      backgroundImage: {
        'luxury-gradient': 'linear-gradient(135deg, #231F20 0%, #184D37 50%, #231F20 100%)',
        'gold-gradient': 'linear-gradient(135deg, #D0B284 0%, #D7BF75 100%)',
        'emerald-gradient': 'linear-gradient(135deg, #184D37 0%, #2D5A47 100%)',
        'bronze-gradient': 'linear-gradient(135deg, #928357 0%, #A69668 100%)',
      },
      backdropBlur: {
        luxury: '20px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
    },
  },
  plugins: [animate],
} satisfies Config;

export default config;
