import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // A autoinscrição pública (`/inscricao/[slug]`, Feature B) é um formulário
  // divulgável em canais externos — não pode ser embarcado em iframe de outro
  // site (clickjacking). O resto do app não tinha nenhum header de segurança
  // definido; por ora só endurecemos esta rota.
  async headers() {
    return [
      {
        source: "/inscricao/:slug*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
