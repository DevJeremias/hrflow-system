import animate from 'tailwindcss-animate'

// Tokens do design system. Pares de texto sobre fundo cumprem WCAG AA (4,5:1); tests/designSystem.test.ts calcula.
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
          DEFAULT: '#4f46e5',
          hover: '#4338ca',
          soft: '#eef2ff',
          line: '#c7d2fe',
        },
        ink: {
          DEFAULT: '#0f172a',
          muted: '#475569',
          subtle: '#64748b',
          inverse: '#ffffff',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f8fafc',
          sunken: '#f1f5f9',
          inverse: '#0a0f1d',
        },
        line: {
          DEFAULT: '#e2e8f0',
          strong: '#cbd5e1',
          // Borda de campo de formulário: 3:1 sobre branco (WCAG 1.4.11).
          input: '#8793a6',
        },
        success: { DEFAULT: '#047857', soft: '#ecfdf5', line: '#a7f3d0' },
        warning: { DEFAULT: '#92400e', soft: '#fffbeb', line: '#fde68a' },
        danger: { DEFAULT: '#b91c1c', hover: '#991b1b', soft: '#fef2f2', line: '#fecaca' },
        info: { DEFAULT: '#1d4ed8', soft: '#eff6ff', line: '#bfdbfe' },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      // Nenhum texto abaixo de 12 px: o piso é o menor degrau da escala.
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        control: '0.75rem',
        card: '1.25rem',
        modal: '1.5rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.05), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        raised: '0 10px 30px -10px rgb(15 23 42 / 0.2)',
        modal: '0 24px 60px -12px rgb(15 23 42 / 0.35)',
      },
    },
  },
  plugins: [animate],
}
