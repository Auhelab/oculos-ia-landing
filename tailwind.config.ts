import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* Sistema de cores light (referência Apple) */
        ink: "#1d1d1f", // texto primário
        "ink-soft": "#6e6e73", // texto secundário
        haze: "#f5f5f7", // superfície cinza-clara (seções e tiles)
        line: "#d2d2d7", // borda de inputs
        "line-soft": "#e8e8ed", // bordas e divisores sutis
        accent: "#0071e3", // única cor de ação
        "accent-hover": "#0077ed",
      },
      fontFamily: {
        sans: ['"Instrument Sans"', "system-ui", "sans-serif"],
      },
      maxWidth: {
        page: "68rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
