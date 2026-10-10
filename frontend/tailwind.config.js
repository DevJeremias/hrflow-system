import animate from 'tailwindcss-animate'

export const PONTO_THEME_COLOR = '#F2B33D'

// Tokens semânticos: os valores mudam por tema em src/index.css.
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--brand-text-rgb) / <alpha-value>)',
          hover: 'rgb(var(--brand-text-hover-rgb) / <alpha-value>)',
          fill: 'rgb(var(--brand-rgb) / <alpha-value>)',
          'fill-hover': 'rgb(var(--brand-hover-rgb) / <alpha-value>)',
          soft: 'rgb(var(--brand-soft-rgb) / <alpha-value>)',
          line: 'rgb(var(--brand-line-rgb) / <alpha-value>)',
          text: 'rgb(var(--brand-text-rgb) / <alpha-value>)',
          'text-hover': 'rgb(var(--brand-text-hover-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--brand-foreground-rgb) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink-rgb) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted-rgb) / <alpha-value>)',
          subtle: 'rgb(var(--ink-subtle-rgb) / <alpha-value>)',
          inverse: 'rgb(var(--ink-inverse-rgb) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface-rgb) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted-rgb) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken-rgb) / <alpha-value>)',
          inverse: 'rgb(var(--surface-inverse-rgb) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--line-rgb) / <alpha-value>)',
          strong: 'rgb(var(--line-strong-rgb) / <alpha-value>)',
          input: 'rgb(var(--line-input-rgb) / <alpha-value>)',
        },
        focus: 'rgb(var(--focus-rgb) / <alpha-value>)',
        overlay: 'rgb(var(--overlay-rgb) / <alpha-value>)',
        success: {
          DEFAULT: 'rgb(var(--success-rgb) / <alpha-value>)',
          soft: 'rgb(var(--success-soft-rgb) / <alpha-value>)',
          line: 'rgb(var(--success-line-rgb) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning-rgb) / <alpha-value>)',
          soft: 'rgb(var(--warning-soft-rgb) / <alpha-value>)',
          line: 'rgb(var(--warning-line-rgb) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger-rgb) / <alpha-value>)',
          hover: 'rgb(var(--danger-hover-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--danger-foreground-rgb) / <alpha-value>)',
          soft: 'rgb(var(--danger-soft-rgb) / <alpha-value>)',
          line: 'rgb(var(--danger-line-rgb) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--info-rgb) / <alpha-value>)',
          soft: 'rgb(var(--info-soft-rgb) / <alpha-value>)',
          line: 'rgb(var(--info-line-rgb) / <alpha-value>)',
        },
        document: {
          DEFAULT: 'rgb(var(--document-ink-rgb) / <alpha-value>)',
          surface: 'rgb(var(--document-surface-rgb) / <alpha-value>)',
          muted: 'rgb(var(--document-muted-rgb) / <alpha-value>)',
          line: 'rgb(var(--document-line-rgb) / <alpha-value>)',
          negative: 'rgb(var(--document-negative-rgb) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['"Geist Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono Variable"', 'ui-monospace', 'monospace'],
      },
      // O piso de texto segue em 12 px para leitura e reflow em telas pequenas.
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        control: '0.375rem',
        card: '0.375rem',
        modal: '0.375rem',
      },
      maxWidth: {
        panel: '32.5rem',
      },
      minWidth: {
        chart: '36rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.18)',
        raised: '0 8px 24px rgb(0 0 0 / 0.28)',
        modal: '0 24px 60px rgb(0 0 0 / 0.55)',
      },
      transitionTimingFunction: {
        ponto: 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
    },
  },
  plugins: [animate],
}
