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
        // O token mantém o nome padrão do Tailwind ("sans") para toda
        // utility existente continuar valendo, mas o corpo do site inteiro
        // é a serifada Playfair Display — par pedido pelo dono da loja.
        sans: ['"Playfair Display"', "Georgia", "serif"],
        // Títulos (h1/h2 via camada base + classe font-display). Baloo 2 é
        // a gêmea GRATUITA da Block Berthold do par de referência — a Block
        // é fonte paga da fundição Berthold, sem versão legal de graça.
        display: ['"Baloo 2"', "system-ui", "sans-serif"],
      },
      maxWidth: {
        page: "68rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
