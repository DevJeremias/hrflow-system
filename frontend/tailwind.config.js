/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0f766e', // Verde escuro elegante (baseado na 2ª imagem)
        primaryHover: '#0d9488',
        secondary: '#1e293b', // Fundo da Sidebar (Slate 800)
      }
    },
  },
  plugins: [],
}