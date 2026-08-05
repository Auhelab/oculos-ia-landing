import { useEffect } from "react";

/**
 * Dificulta a cópia casual de copy, imagens e layout.
 *
 * LIMITE HONESTO DESTA CAMADA: nada aqui impede alguém determinado. `Ctrl+U`,
 * "Salvar página", `curl`, ou simplesmente desligar o JavaScript contornam tudo
 * isto em segundos — e um raspador de IA nunca chega a executar este código,
 * porque ele lê o HTML cru. Isto é lombada contra cópia oportunista; a barreira
 * de verdade está no robots.txt, nos headers do vercel.json e no direito autoral.
 *
 * O que NÃO é bloqueado, de propósito: qualquer campo de formulário e tudo que
 * estiver marcado com `data-copiavel`. É por onde o cliente copia o código Pix,
 * o número do pedido e o código de rastreio — bloquear isso quebraria a compra,
 * que é justamente o que a página existe pra fazer.
 */

/** Seletor das ilhas onde copiar continua liberado. */
const LIVRE =
  'input, textarea, select, [contenteditable="true"], [data-copiavel], [data-copiavel] *';

function estaLiberado(node: EventTarget | null): boolean {
  if (!(node instanceof Node)) return false;
  const el = node instanceof Element ? node : node.parentElement;
  return el?.closest(LIVRE) != null;
}

/**
 * A cópia em curso partiu de uma ilha liberada?
 *
 * Precisa das três checagens: `window.getSelection()` NÃO enxerga a seleção
 * interna de um `<input>`/`<textarea>` (ela vive no próprio elemento), então
 * copiar o código Pix cairia no bloqueio se olhássemos só para a seleção.
 */
function copiaLiberada(alvo: EventTarget | null): boolean {
  // Havendo seleção no documento, ela é a fonte da verdade: é exatamente o que
  // será copiado. Consultar o activeElement antes daqui abriria um furo — com
  // um campo em foco, a copy da página inteira passaria.
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    return estaLiberado(sel.getRangeAt(0).commonAncestorContainer);
  }

  // Seleção vazia no documento = a cópia veio de dentro de um input/textarea,
  // cuja seleção interna o getSelection() não expõe.
  return estaLiberado(alvo) || estaLiberado(document.activeElement);
}

export interface OpcoesProtecao {
  /**
   * Bloqueia F12 / Ctrl+Shift+I / Ctrl+U. Desligado por padrão: não impede
   * ninguém (o menu do navegador abre o devtools do mesmo jeito) e atrapalha
   * quem estiver depurando a própria loja. Ligue só se quiser o efeito.
   */
  bloquearDevtools?: boolean;
}

export function useContentProtection(opcoes: OpcoesProtecao = {}): void {
  const { bloquearDevtools = false } = opcoes;

  useEffect(() => {
    // 1. Menu de contexto — tira o "Salvar imagem como..." e o "Copiar texto".
    const onContextMenu = (e: MouseEvent) => {
      if (estaLiberado(e.target)) return;
      e.preventDefault();
    };

    // 2. Arrastar imagem pra área de trabalho / outra aba.
    const onDragStart = (e: DragEvent) => {
      const el = e.target;
      if (el instanceof HTMLImageElement || el instanceof HTMLCanvasElement) {
        e.preventDefault();
      }
    };

    // 3. Copiar. Fora das ilhas liberadas, troca o conteúdo da área de
    //    transferência por um aviso de autoria — assim a cópia falha de forma
    //    visível e ainda deixa rastro de origem se alguém colar mesmo assim.
    const onCopy = (e: ClipboardEvent) => {
      if (copiaLiberada(e.target)) return;
      e.preventDefault();
      e.clipboardData?.setData(
        "text/plain",
        `Conteúdo protegido por direitos autorais — ${window.location.origin}`,
      );
    };

    // 4. Recortar fora de formulário não tem uso legítimo nesta página.
    const onCut = (e: ClipboardEvent) => {
      if (copiaLiberada(e.target)) return;
      e.preventDefault();
    };

    // 5. Ctrl+S (salvar página) e Ctrl+P (imprimir/PDF) — as duas formas mais
    //    rápidas de levar a página inteira embora com imagens e estilos.
    const onKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const tecla = e.key.toLowerCase();

      if (ctrl && (tecla === "s" || tecla === "p")) {
        e.preventDefault();
        return;
      }

      if (!bloquearDevtools) return;
      if (e.key === "F12" || (ctrl && tecla === "u")) {
        e.preventDefault();
        return;
      }
      if (ctrl && e.shiftKey && ["i", "j", "c"].includes(tecla)) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [bloquearDevtools]);
}
