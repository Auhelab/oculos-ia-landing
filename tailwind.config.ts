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
        // Única cor de ação. Verde escuro por escolha de marca — os verdes
        // vivos (iOS #34c759, green-600) reprovam o contraste de 4.5:1 com
        // texto branco; este dá 5.0:1.
        accent: "#15803d",
        "accent-hover": "#166534",
      },
      fontFamily: {
        sans: ['"Instrument Sans"', "system-ui", "sans-serif"],
        // Títulos (h1/h2 via camada base + classe font-display). Um peso só
        // (600) para não pesar o carregamento — Oswald é condensada, então
        // dispensa o tracking negativo que os títulos usavam antes.
        display: ["Oswald", '"Instrument Sans"', "system-ui", "sans-serif"],
        // Fonte de acento manuscrita: SÓ etiqueta eyebrow e citações de
        // avaliação. Nunca em preço, botão ou checkout — manuscrita no
        // caminho do dinheiro derruba a credibilidade.
        hand: ['"Indie Flower"', "cursive"],
      },
      maxWidth: {
        page: "68rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
