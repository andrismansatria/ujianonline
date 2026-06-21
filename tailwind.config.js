/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        utu: {
          primary: '#1e3a8a',
          secondary: '#0e7490',
          accent: '#f59e0b',
        }
      }
    }
  },
  plugins: [],
}
