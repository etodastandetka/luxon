/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        tgBg: "#0e1621",
        tgText: "#e3edf7",
        primary: "#2ea6ff",
        accent: "#00c2ff"
      }
    }
  },
  plugins: [],
};
