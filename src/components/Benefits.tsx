import type { ReactNode } from "react";

interface Benefit {
  title: string;
  description: string;
  icon: ReactNode;
}

const iconProps = {
  className: "h-7 w-7",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
  "aria-hidden": true,
} as const;

const benefits: Benefit[] = [
  {
    title: "Tradução por IA em tempo real",
    description:
      "Converse em mais de 100 idiomas: a IA traduz e fala direto no seu ouvido, ideal para viagens e negócios.",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z" />
      </svg>
    ),
  },
  {
    title: "Câmera HD 8MP",
    description:
      "Fotos nítidas e vídeos em alta definição com um toque na haste — registre tudo em primeira pessoa, sem tirar o celular do bolso.",
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="7" width="18" height="13" rx="3" />
        <path d="M8.5 7l1.2-2.4A1 1 0 0 1 10.6 4h2.8a1 1 0 0 1 .9.6L15.5 7" />
        <circle cx="12" cy="13.5" r="3.5" />
      </svg>
    ),
  },
  {
    title: "Música e chamadas Bluetooth",
    description:
      "Áudio aberto direcionado ao ouvido: ouça música, atenda chamadas e fale com o assistente de voz sem fones.",
    icon: (
      <svg {...iconProps}>
        <path d="M9 18V6l10-2v11.5" />
        <circle cx="6.5" cy="18" r="2.5" />
        <circle cx="16.5" cy="15.5" r="2.5" />
      </svg>
    ),
  },
  {
    title: "3 lentes intercambiáveis",
    description:
      "Troque as lentes em segundos: proteção UV400 para sol, tela e uso diário, com armação leve e confortável.",
    icon: (
      <svg {...iconProps}>
        <path d="M2 10h20M4 10l1.5 5.5A3 3 0 0 0 8.4 18h1.2a3 3 0 0 0 2.9-2.5L13 10M13 10l.5 5.5a3 3 0 0 0 3 2.5h1.1a3 3 0 0 0 2.9-2.5L22 10" />
      </svg>
    ),
  },
];

export default function Benefits() {
  return (
    <section id="beneficios" className="py-20 sm:py-28">
      <div className="mx-auto max-w-page px-6">
        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
          Por que você vai amar.
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-white/60">
          Tecnologia de ponta em cada detalhe — da lente ao som.
        </p>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit) => (
            <li
              key={benefit.title}
              className="glass group p-8 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.12]"
            >
              <span className="inline-flex rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-400/20 to-violet-500/20 p-3 text-cyan-300 transition group-hover:from-cyan-400/40 group-hover:to-violet-500/40">
                {benefit.icon}
              </span>
              <h3 className="mt-5 font-display text-xl font-bold tracking-tight">
                {benefit.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-white/60">
                {benefit.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
