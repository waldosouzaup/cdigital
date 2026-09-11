/**
 * Manifesto PWA — Fase 4, item 2 ("PWA instalável"). O Next injeta o
 * `<link rel="manifest">` em todas as rotas automaticamente por este arquivo
 * existir. `start_url` aponta para a tela de campo: o app instalado abre direto
 * no registro de atividade.
 */
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Comitê Digital — Campo",
    short_name: "Comitê Campo",
    description: "Registro de atividades de campo. Funciona sem sinal — a fila sobe sozinha.",
    start_url: "/configuracoes?aba=atividades",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0E11",
    theme_color: "#157F58",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
