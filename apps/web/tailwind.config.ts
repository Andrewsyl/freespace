import type { Config } from "tailwindcss";
import { designTokens } from "../../design-system/tokens";

const { brand } = designTokens.color;
const { card } = designTokens.shadow;
const { display, body } = designTokens.typography.fontFamily;
const { tight } = designTokens.typography.tracking;
const toFontStack = (value: string) => value.split(",").map((item) => item.trim().replace(/^"|"$/g, ""));

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand,
      },
      boxShadow: {
        card,
      },
      letterSpacing: {
        tighter: tight,
      },
      fontFamily: {
        sans: toFontStack(body),
        display: toFontStack(display),
      },
      keyframes: {
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(12px) scale(0.95)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "toast-in": "toast-in 0.2s ease-out forwards",
      },
    }
  },
  plugins: []
};

export default config;
