export interface ProductImage {
  src: string;
  alt: string;
}

export interface ProductConfig {
  /** Identificador enviado ao backend. O preço NUNCA sai do frontend — será fixado no servidor (Etapa 3). */
  id: string;
  name: string;
  tagline: string;
  /** Preço de exibição em centavos (ex.: 39990 = R$ 399,90). Apenas visual: o valor real vive no backend. */
  priceCents: number;
  /** Preço "de" riscado para ancoragem. Use null para esconder. */
  compareAtPriceCents: number | null;
  /** Número máximo de parcelas exibidas na oferta. */
  maxInstallments: number;
  /** Gatilho de escassez ("Restam X unidades"). Use null para desligar. */
  stockLeft: number | null;
  images: ProductImage[];
}

export const product: ProductConfig = {
  id: "oculos-inteligentes-ia-2026",
  name: "Óculos Inteligentes IA",
  tagline: "Câmera, tradução por IA e música — direto nos seus óculos.",
  priceCents: 39990,
  compareAtPriceCents: 59990,
  maxInstallments: 12,
  stockLeft: 23,
  images: [
    {
      src: "/images/product-hero.svg",
      alt: "Óculos inteligentes pretos com câmera integrada na armação",
    },
  ],
};
