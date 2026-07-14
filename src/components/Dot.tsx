/**
 * Separador em ponto (•) entre trechos de texto. Renderizado como um pequeno
 * círculo alinhado ao centro vertical da linha (align-middle) — assim fica
 * opticamente no meio do texto, sem "subir" como o glifo "·" faz em algumas fontes.
 * Tamanho em em: acompanha o tamanho da fonte ao redor.
 */
export default function Dot() {
  return (
    <span
      aria-hidden="true"
      className="mx-[0.5em] inline-block h-[0.26em] w-[0.26em] rounded-full bg-current align-middle opacity-60"
    />
  );
}
