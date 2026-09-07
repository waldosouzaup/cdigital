import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Tipografia definida na Tarefa 8 (telas de auth), processo da skill front-end-design
// — ver o comentário no topo de globals.css e o registro em CONSULTAS.md.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

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
      <body className={`${archivo.variable} ${plexMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
