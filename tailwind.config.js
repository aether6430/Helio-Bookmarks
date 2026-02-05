/** @type {import('tailwindcss').Config} */
export default {
  content: ["./web/index.html", "./web/src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Work Sans'", "sans-serif"],
      },
      colors: {
        ink: {
          50: "#f4f7f8",
          200: "#cfd9df",
          500: "#2b3a42",
          700: "#1c252b",
          900: "#11181d",
        },
        sand: {
          50: "#fff8ef",
          200: "#f6e3c9",
          500: "#e9c79b",
        },
        moss: {
          400: "#1f7a6b",
          600: "#145247",
        },
      },
      boxShadow: {
        soft: "0 25px 60px -35px rgba(18, 11, 51, 0.45)",
      },
    },
  },
  plugins: [],
};
