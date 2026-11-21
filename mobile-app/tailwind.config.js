// Couleurs recopiées depuis le design system web (input.css, @theme).
module.exports = {
  content: ["./App.js", "./src/**/*.{js,jsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2f6b47", 50: "#f5f8f6", 100: "#e6ede9", 200: "#c5d6cb", 300: "#9fbbaa", 400: "#69947b",
          500: "#2f6b47", 600: "#295e3e", 700: "#224d33", 800: "#1a3c28", 900: "#142d1e", 950: "#0d1e14",
        },
        secondary: {
          DEFAULT: "#e09f3e", 50: "#fdfaf5", 100: "#fbf3e8", 200: "#f6e4c9", 300: "#f1d3a6", 400: "#e9ba74",
          500: "#e09f3e", 600: "#c58c37", 700: "#a1722d", 800: "#7d5923", 900: "#5e431a", 950: "#3f2d11",
        },
        "background-primary": "#f5efe0",
        "background-surface": "#fdfaf4",
        "primary-text": "#1a3c2a",
        "secondary-text": "#6b8c76",
        "disabled-text": "#a8bfb0",
        "defaut-text": "#333333",
        "defaut-border": "#ddd5c0",
        warning: "#e09f3e",
        error: "#c0503a",
        info: "#4a7fa5",
      },
    },
  },
  plugins: [],
};
