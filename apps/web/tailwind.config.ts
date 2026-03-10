import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#2ecc8f",
          600: "#27b67f",
          700: "#1f8f64",
          800: "#1a6e4d",
          900: "#14573c"
        }
      },
      boxShadow: {
        card: "0 16px 40px rgba(15, 23, 42, 0.08)"
      },
      letterSpacing: {
        tighter: "-0.04em",
      },
      fontFamily: {
        sans: ["Poppins", "Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
    }
  },
  plugins: []
};

export default config;
