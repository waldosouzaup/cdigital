import type { Metadata } from "next";
import "./globals.css";

// A tipografia definitiva é decisão da Tarefa 8 (telas de auth), seguindo o processo
// de duas passadas da skill front-end-design — não improvisada aqui no layout raiz.

export const metadata: Metadata = {
  title: "Comitê Digital",
  description:
    "Gestão de equipe temporária, contratos por período determinado e prestação de contas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
