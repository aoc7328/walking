import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          page: 'var(--bg-page)',
          card: 'var(--bg-card)',
          soft: 'var(--bg-soft)',
          softer: 'var(--bg-softer)',
        },
        ink: {
          primary: 'var(--ink-primary)',
          secondary: 'var(--ink-secondary)',
          muted: 'var(--ink-muted)',
          faint: 'var(--ink-faint)',
        },
        accent: {
          primary: 'var(--accent-primary)',
          'primary-soft': 'var(--accent-primary-soft)',
          warm: 'var(--accent-warm)',
          'warm-soft': 'var(--accent-warm-soft)',
          purple: 'var(--accent-purple)',
        },
        border: {
          soft: 'var(--border-soft)',
          medium: 'var(--border-medium)',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Noto Serif TC', 'Georgia', 'serif'],
        body: ['Noto Serif TC', 'Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        card: 'var(--shadow-card)',
        modal: 'var(--shadow-modal)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        med: '250ms',
        slow: '400ms',
      },
    },
  },
  plugins: [],
};

export default config;
