import { useEffect, useRef, useState } from "react";

/**
 * Scroll-scrub cinematográfico (método Apple/Starlink): uma sequência real de
 * 60 frames extraídos do vídeo de estúdio do produto — um ARCO de três quartos
 * à direita → frente → três quartos à esquerda — é desenhada num <canvas>, e o
 * índice do frame é dirigido pela posição do scroll — mapeamento LINEAR, então a
 * velocidade da rotação é constante ao longo de todo o trajeto.
 *
 * Estrutura: a seção é alta (280vh — era 460vh, encurtada porque o giro pedia
 * rolagem demais) e o palco fica sticky ocupando a viewport.
 * O progresso do scroll (0→1) mistura GIRO + APROXIMAÇÃO + FOCO + FADE em 3 trechos:
 *  - 0.00–0.10  ENTRADA: materializa — desfoca→nítido + fade-in + escala 0.84→1
 *  - 0.10–0.82  GIRO: frames 0→59 (arco), legendas Tradução/Câmera/Música
 *               alternando de lado
 *  - 0.82–1.00  PARADA: o produto congela no último frame, nítido e inteiro;
 *               o CTA entra por baixo dele
 *
 * Frames pré-carregados (~720 KB no total), e só quando a seção se aproxima —
 * a primeira tela não disputa banda com eles. Fallback estático sem JS /
 * reduced-motion. Só transform/opacity/filter + draw no canvas (60fps).
 */

const FRAME_COUNT = 60;
const FRAME_SRC = Array.from(
  { length: FRAME_COUNT },
  (_, i) => `/images/spin/${String(i).padStart(3, "0")}.webp`,
);
// Largura do palco (min(92vw, 60rem) = no máximo 960px), que é onde o canvas é
// desenhado — não há mais push-in, o produto fica em escala 1 o tempo todo.
// Casar o frame com essa largura derruba o peso da sequência de 2.3 MB para
// 720 KB. Em monitor retina grande o canvas ainda pede o dobro disso, então o
// produto fica um pouco menos definido ali; no celular, onde o palco tem uns
// 360px, sobra resolução.
const FRAME_W = 960;
const FRAME_H = 540;

// Tamanho ÚNICO do produto durante toda a seção. 1 = o palco inteiro
// (min(92vw, 60rem)). Subir daqui aumenta a presença, mas em tela de notebook
// (~650px de altura) o canvas passa a ocupar a tela toda e o topo é cortado.
const PRODUCT_SCALE = 1;

const ROT_START = 0.1;
const ROT_END = 0.82;

interface Beat {
  word: string;
  eyebrow: string;
  title: string;
  text: string;
  side: "left" | "right";
  at: number; // centro da janela, em progresso de rotação (0..1)
}

const beats: Beat[] = [
  {
    word: "TRADUÇÃO",
    eyebrow: "Tradução por IA",
    title: "Fale qualquer idioma.",
    text: "Mais de 100 idiomas traduzidos em tempo real, com a resposta falada direto no seu ouvido.",
    side: "left",
    at: 0.16,
  },
  {
    word: "CÂMERA",
    eyebrow: "Câmera HD 8MP",
    title: "Registre em primeira pessoa.",
    text: "Fotos nítidas e vídeos em alta definição com um toque na haste · sem tirar o celular do bolso.",
    side: "right",
    at: 0.5,
  },
  {
    word: "MÚSICA",
    eyebrow: "Áudio aberto",
    title: "Sua trilha sonora, sem fones.",
    text: "Música, chamadas e assistente de voz por Bluetooth, com áudio direcionado só para você.",
    side: "left",
    at: 0.84,
  },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Janela triangular suavizada centrada em `center`, com meia-largura `half`. */
function window01(p: number, center: number, half: number) {
  const d = Math.abs(p - center) / half;
  return d >= 1 ? 0 : (1 - d) * (1 - d) * (3 - 2 * (1 - d));
}

export default function SpinShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const capRefs = useRef<(HTMLDivElement | null)[]>([]);
  const finalRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [reduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (reduced) return;
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!section || !canvas || !stage) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const images: HTMLImageElement[] = [];
    let loaded = 0;
    let lastFrame = -1;
    let cssW = 0;
    let cssH = 0;
    let rafId = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = stage.clientWidth;
      cssH = Math.round(cssW * (FRAME_H / FRAME_W));
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lastFrame = -1; // força redraw
    };

    const drawFrame = (idx: number) => {
      const img = images[idx];
      if (!img || !img.complete || img.naturalWidth === 0) return;
      if (idx === lastFrame) return;
      lastFrame = idx;
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.drawImage(img, 0, 0, cssW, cssH);
    };

    // Progresso cru (0→1) do scroll dentro do trilho pinado.
    //
    // O trilho começa ANTES de a seção grudar no topo: enquanto ela sobe a
    // tela, já contamos progresso. Sem isso o visitante rola o Hero inteiro
    // (uma tela cheia) com a animação parada, e ela só arranca no segundo
    // fôlego de rolagem. LEAD é quanto dessa aproximação entra no trilho.
    const LEAD_RATIO = 0.7;
    const readTarget = () => {
      const lead = window.innerHeight * LEAD_RATIO;
      const total = section.offsetHeight - window.innerHeight + lead;
      const rect = section.getBoundingClientRect();
      return total > 0 ? clamp01((lead - rect.top) / total) : 0;
    };

    // Desenha um estado de progresso JÁ suavizado (p = renderP, não o scroll cru)
    const render = (p: number) => {
      // Rotação: mapeamento LINEAR do progresso → índice de frame
      const pRot = clamp01((p - ROT_START) / (ROT_END - ROT_START));
      const idx = Math.round(pRot * (FRAME_COUNT - 1));
      drawFrame(idx);

      // Mistura giro + aproximação + foco + fade, encadeados em 3 trechos:
      //  entrada  → materializa (blur↓ + opacity↑ + escala↑)
      //  miolo    → GIRA com push-in contínuo (aproximação lenta)
      //  saída    → para no último frame, nítido, e o CTA entra por baixo
      // O produto tem UM tamanho só, do começo ao fim: nada de push-in durante
      // o giro nem de encolher no final. O único movimento além da rotação é a
      // subida no trecho final, que abre espaço para o título e o botão.
      const scale = PRODUCT_SCALE;
      let blur: number;
      let fade: number;
      let liftPct = 0; // deslocamento vertical, em % da altura do canvas
      if (p < ROT_START) {
        const pe = clamp01(p / ROT_START);
        fade = pe;
        blur = (1 - pe) * 12; // materializa por foco, não por tamanho
      } else if (p <= ROT_END) {
        fade = 1;
        blur = 0;
      } else {
        // Depois do giro o produto PARA no último frame e fica lá: sem
        // desfoque, sem sumir, do mesmo tamanho. Só sobe para liberar a faixa
        // de baixo — sem isso o canvas ocupa a tela quase inteira e o CTA cai
        // por cima dele em telas de notebook.
        const pd = clamp01((p - ROT_END) / (1 - ROT_END));
        const ease = clamp01(pd / 0.35); // acomoda no início do trecho e para
        fade = 1;
        blur = 0;
        liftPct = -16 * ease;
      }
      canvas.style.opacity = String(fade);
      canvas.style.transform = `translateY(${liftPct.toFixed(2)}%) scale(${scale.toFixed(3)})`;
      canvas.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : "none";

      // Palavras gigantes + legendas por janela (só durante a rotação)
      let active = -1;
      let best = 0;
      beats.forEach((beat, i) => {
        const vis = p > ROT_END ? 0 : window01(pRot, beat.at, 0.2);
        const cap = capRefs.current[i];
        if (cap) {
          cap.style.opacity = String(vis);
          cap.style.filter = `blur(${(1 - vis) * 6}px)`;
          cap.style.transform = `translateY(${(1 - vis) * 16}px)`;
        }
        if (vis > best) {
          best = vis;
          active = i;
        }
      });

      // Desfecho
      const finalVis = p > ROT_END ? clamp01((p - 0.88) / 0.08) : 0;
      if (finalRef.current) {
        finalRef.current.style.opacity = String(finalVis);
        finalRef.current.style.transform = `translateY(${(1 - finalVis) * 20}px)`;
        finalRef.current.style.pointerEvents = finalVis > 0.6 ? "auto" : "none";
      }

      dotRefs.current.forEach((dot, i) => {
        if (dot) dot.style.opacity = p <= ROT_END && i === active ? "1" : "0.25";
      });
    };

    // Inércia estilo Apple (scrub:1): renderP PERSEGUE targetP com atraso, num
    // rAF contínuo enquanto o palco está visível — é o que troca "giro rígido"
    // por "giro amanteigado". SMOOTH = quão rápido alcança (0.12 ≈ ~130ms).
    const SMOOTH = 0.12;
    let targetP = readTarget();
    let renderP = targetP;
    let lastRP = -1;
    let running = false;

    const loop = () => {
      targetP = readTarget();
      renderP += (targetP - renderP) * SMOOTH;
      if (Math.abs(targetP - renderP) < 0.0002) renderP = targetP; // assenta
      if (renderP !== lastRP) {
        render(renderP);
        lastRP = renderP;
      }
      if (running) rafId = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!running) {
        running = true;
        rafId = requestAnimationFrame(loop);
      }
    };
    const stop = () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      // assenta no estado correto ao sair de vista
      targetP = renderP = readTarget();
      render(renderP);
      lastRP = renderP;
    };

    // Só roda o loop quando o palco está na viewport (poupa bateria fora dela)
    const io = new IntersectionObserver(
      (entries) => (entries[0].isIntersecting ? start() : stop()),
      { threshold: 0 },
    );
    io.observe(section);

    // Pré-carrega os frames; desenha o primeiro assim que chega. Só dispara
    // quando a seção chega a uma tela e meia de distância: assim os 60 pedidos
    // não competem com o herói no primeiro carregamento, que é o que pesa em
    // celular modesto. Uma tela e meia dá folga de sobra para o primeiro frame
    // chegar antes de a seção aparecer.
    let framesPedidos = false;
    const carregarFrames = () => {
      if (framesPedidos) return;
      framesPedidos = true;
      FRAME_SRC.forEach((src, i) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          loaded++;
          if (i === 0) {
            resize();
            targetP = renderP = readTarget();
            render(renderP);
            lastRP = renderP;
          }
          if (loaded === FRAME_COUNT && !running) render(renderP);
        };
        img.src = src;
        images[i] = img;
      });
    };

    const ioPreload = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        ioPreload.disconnect();
        carregarFrames();
      },
      { rootMargin: "150% 0px" },
    );
    ioPreload.observe(section);

    // Rede de segurança: se o IntersectionObserver não entregar nada (acontece
    // em navegadores embutidos e webviews), os frames entram mesmo assim depois
    // que a primeira tela já pintou. Sem isso o palco fica em branco para sempre.
    const destravar = window.setTimeout(carregarFrames, 3000);

    resize();
    const onResize = () => {
      resize();
      targetP = renderP = readTarget();
      render(renderP);
      lastRP = renderP;
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      io.disconnect();
      ioPreload.disconnect();
      clearTimeout(destravar);
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
    };
  }, [reduced]);

  // Fallback estático: mostra o produto de frente + as 3 features empilhadas
  if (reduced) {
    return (
      <section aria-label="Destaques do produto" className="py-24">
        <div className="mx-auto max-w-page px-6">
          <img
            // Frame do meio: é onde o produto aparece exatamente de frente.
            src={FRAME_SRC[Math.floor(FRAME_COUNT / 2)]}
            alt="Óculos inteligentes pretos com câmera integrada na armação"
            width={FRAME_W}
            height={FRAME_H}
            className="mx-auto w-full max-w-2xl"
            loading="lazy"
            decoding="async"
          />
          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {beats.map((b) => (
              <div key={b.word}>
                <p className="eyebrow">{b.eyebrow}</p>
                <h3 className="mt-2 text-2xl font-bold tracking-[-0.02em]">{b.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} aria-label="Destaques do produto" className="relative h-[280vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        {/* Palco do produto (canvas) */}
        <div ref={stageRef} className="relative z-10 w-[min(92vw,60rem)]">
          <canvas ref={canvasRef} className="w-full will-change-[transform,filter]" />
        </div>

        {/* Legendas das 3 features (desktop: alternam de lado / mobile: base) */}
        {beats.map((beat, i) => (
          <div
            key={beat.title}
            className={`absolute inset-x-6 bottom-[8%] z-20 md:inset-x-auto md:bottom-auto md:top-1/2 md:w-[21rem] md:-translate-y-1/2 ${
              beat.side === "left" ? "md:left-[6%]" : "md:right-[6%]"
            }`}
          >
            <div
              ref={(el) => {
                capRefs.current[i] = el;
              }}
              // No desktop a legenda fica POR CIMA do produto. Um painel opaco
              // de cantos retos corta a foto numa linha visível — por isso o
              // fundo é um degradê que morre em transparente na direção do
              // produto, dissolvendo a borda em vez de recortá-la. Sem
              // backdrop-blur pelo mesmo motivo: ele desenha o retângulo.
              className={`rounded-3xl text-center will-change-[opacity,transform] md:p-7 md:text-left ${
                beat.side === "left"
                  ? "md:bg-gradient-to-r md:from-white md:via-white/85 md:to-transparent"
                  : "md:bg-gradient-to-l md:from-white md:via-white/85 md:to-transparent"
              }`}
              style={{ opacity: 0 }}
            >
              <p className="eyebrow">{beat.eyebrow}</p>
              <h3 className="mt-3 text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
                {beat.title}
              </h3>
              <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-ink-soft sm:text-base md:mx-0">
                {beat.text}
              </p>
            </div>
          </div>
        ))}

        {/* Desfecho + CTA */}
        <div className="pointer-events-none absolute inset-x-6 bottom-[10%] z-20 text-center">
          <div ref={finalRef} className="will-change-[opacity,transform]" style={{ opacity: 0 }}>
            <h2 className="text-3xl font-extrabold sm:text-5xl">
              Tudo isso, num só óculos.
            </h2>
            <a href="#checkout" className="btn-primary mt-6 px-8">
              Garantir o meu
            </a>
          </div>
        </div>

        {/* Progresso das features */}
        <div className="absolute bottom-7 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          {beats.map((_, i) => (
            <span
              key={i}
              ref={(el) => {
                dotRefs.current[i] = el;
              }}
              className="h-1.5 w-7 rounded-full bg-ink"
              style={{ opacity: i === 0 ? 1 : 0.25 }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
