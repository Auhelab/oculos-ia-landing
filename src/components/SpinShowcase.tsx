import { useEffect, useRef, useState } from "react";

/**
 * Scroll-scrub cinematográfico (método Apple/Starlink): uma sequência real de
 * 120 frames do produto num GIRO 360° COMPLETO (vídeo gerado a partir das fotos
 * reais de estúdio — frente→perfil→traseira→perfil→frente) é desenhada num
 * <canvas>, e o índice do frame é dirigido pela posição do scroll — mapeamento
 * LINEAR, então a velocidade de rotação é constante ao longo de toda a volta.
 *
 * Estrutura: a seção é alta (460vh) e o palco fica sticky ocupando a viewport.
 * O progresso do scroll (0→1) mistura GIRO + APROXIMAÇÃO + FOCO + FADE em 3 trechos:
 *  - 0.00–0.10  ENTRADA: materializa — desfoca→nítido + fade-in + escala 0.84→1
 *  - 0.10–0.82  GIRO: frames 0→119 (360°) com push-in contínuo (escala 1→1.2),
 *               legendas Tradução/Câmera/Música alternando de lado
 *  - 0.82–1.00  MERGULHO: escala 1.2→~2.2 + desfoque + fade-out, revela o CTA
 *
 * Frames pré-carregados (~1.3 MB no total). Fallback estático sem JS /
 * reduced-motion. Só transform/opacity/filter + draw no canvas (60fps).
 */

const FRAME_COUNT = 120;
const FRAME_SRC = Array.from(
  { length: FRAME_COUNT },
  (_, i) => `/images/spin/${String(i).padStart(3, "0")}.webp`,
);
const FRAME_W = 880;
const FRAME_H = 564;

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
    text: "Fotos nítidas e vídeos em alta definição com um toque na haste — sem tirar o celular do bolso.",
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

    // Progresso cru (0→1) do scroll dentro do trilho pinado
    const readTarget = () => {
      const total = section.offsetHeight - window.innerHeight;
      const rect = section.getBoundingClientRect();
      return total > 0 ? clamp01(-rect.top / total) : 0;
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
      //  saída    → mergulho (escala↑↑) + desfoca + some, revelando o CTA
      let scale: number;
      let blur: number;
      let fade: number;
      if (p < ROT_START) {
        const pe = clamp01(p / ROT_START);
        fade = pe;
        blur = (1 - pe) * 12;
        scale = 0.84 + pe * 0.16; // 0.84 → 1.0
      } else if (p <= ROT_END) {
        const pr = clamp01((p - ROT_START) / (ROT_END - ROT_START));
        fade = 1;
        blur = 0;
        scale = 1 + pr * 0.2; // push-in 1.0 → 1.2 durante o giro
      } else {
        const pd = clamp01((p - ROT_END) / (1 - ROT_END));
        scale = 1.2 + pd * pd * 1.0; // mergulho 1.2 → ~2.2
        blur = pd * 8;
        fade = 1 - clamp01((pd - 0.55) / 0.45);
      }
      canvas.style.opacity = String(fade);
      canvas.style.transform = `scale(${scale.toFixed(3)})`;
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

    // Pré-carrega os frames; desenha o primeiro assim que chega
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
            src={FRAME_SRC[0]}
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
    <section ref={sectionRef} aria-label="Destaques do produto" className="relative h-[460vh]">
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
              className="rounded-3xl text-center will-change-[opacity,transform] md:bg-white/70 md:p-7 md:text-left md:backdrop-blur-xl"
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
            <h2 className="text-3xl font-bold tracking-[-0.02em] sm:text-5xl">
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
