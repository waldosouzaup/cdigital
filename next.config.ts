import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // A autoinscrição pública (`/inscricao/[slug]`, Feature B) é um formulário
  // divulgável em canais externos — não pode ser embarcado em iframe de outro
  // site (clickjacking). O resto do app não tinha nenhum header de segurança
  // definido; por ora só endurecemos esta rota.
  async rewrites() {
    return [
      {
        source: "/candidado-eleicao-2026",
        destination: "/inscricao/candidado-eleicao-2026",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/inscricao/:slug*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        // Telas de assinatura eletrônica: documento com valor jurídico sendo
        // aceito por clique. Embarcar isso em iframe de terceiro é clickjacking
        // com consequência contratual.
        source: "/assinar/:token*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        source: "/assinar-distrato/:token*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        source: "/candidado-eleicao-2026",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
