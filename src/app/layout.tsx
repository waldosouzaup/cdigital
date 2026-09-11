import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Tipografia oficial do projeto: Família Inter (fonte variável cobrindo pesos 100 a 900)
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Comitê Digital",
  description:
    "Gestão de equipe temporária, contratos por período determinado e prestação de contas.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

const temaScript = `(function() {
  try {
    var salvo = localStorage.getItem('cd-theme');
    if (salvo === 'light') {
      document.documentElement.dataset.theme = 'light';
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.dataset.theme = 'dark';
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${plexMono.variable} ${inter.className} dark`}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: temaScript }} />
      </head>
      <body className={`${inter.className} antialiased bg-canvas text-ink`}>
        {children}
      </body>
    </html>
  );
}
