/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6366f1', // O roxo que usas no design
        secondary: '#26245c', // O fundo da tua Sidebar
      }
    },
  },
  plugins: [],
}