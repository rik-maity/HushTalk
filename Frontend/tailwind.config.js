/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        muted: "#718096",
        brand: "#5b67e8",
        "brand-soft": "#eef0ff"
      },
      boxShadow: {
        panel: "0 12px 40px rgba(24, 35, 64, 0.06)"
      }
    }
  },
  plugins: []
};