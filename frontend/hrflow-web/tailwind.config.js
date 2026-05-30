/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#8b3800', 
        primaryHover: '#7e3301',
        
        // Preto acinzentado (escuro, mas suave aos olhos)
        dark: '#1e293b', // Esse é o equivalente ao slate-800
        darker: '#0f172a' // Esse é o equivalente ao slate-900
      }
    },
  },
  plugins: [],
}