/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'jarvis-blue': '#00d2ff',
        'jarvis-dark': '#0a0a0c',
        'jarvis-panel': 'rgba(15, 20, 25, 0.8)',
      },
      boxShadow: {
        'glow': '0 0 15px rgba(0, 210, 255, 0.4)',
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
      }
    },
  },
  plugins: [],
}
