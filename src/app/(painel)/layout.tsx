"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Marca } from "@/components/marca";
import { SeletorTema } from "@/components/seletor-tema";

const navegacao = [
  { rotulo: "Painel Geral", href: "/dashboard", icone: "⊞" },
  { rotulo: "Equipe / Pessoas", href: "/pessoas", icone: "👥" },
  { rotulo: "Contratos & Vigor", href: "/contratos", icone: "📄" },
  { rotulo: "Escala de Turnos", href: "/escalas", icone: "🗓" },
  { rotulo: "Conferência de Documentos", href: "/documentos", icone: "🔍" },
  { rotulo: "Configurações & Governança", href: "/configuracoes", icone: "⚙" },
];

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-canvas text-ink">
      {/* Barra superior Mobile */}
      <header className="flex md:hidden items-center justify-between border-b border-line bg-surface px-4 py-3 sticky top-0 z-40 shadow-xs">
        <Marca subtitulo="" />
        <div className="flex items-center gap-2">
          <SeletorTema />
          <button
            type="button"
            onClick={() => setMenuAberto(!menuAberto)}
            className="rounded-md border border-line bg-surface-sunken px-2.5 py-1 text-xs font-mono text-ink-muted hover:text-ink cursor-pointer"
          >
            {menuAberto ? "✕ FECHAR" : "☰ MENU"}
          </button>
        </div>
      </header>

      {/* Menu Lateral / Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col justify-between border-r border-line bg-surface px-5 py-6 transition-transform duration-200 ease-in-out md:static md:translate-x-0 shadow-xs ${
          menuAberto ? "translate-x-0 shadow-xl" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div>
          <div className="hidden md:block pb-6 border-b border-line">
            <Marca subtitulo="Sistema de Gestão" />
          </div>

          <nav className="mt-6 md:mt-8">
            <span className="block text-[0.68rem] font-mono tracking-wider text-ink-muted uppercase mb-3 px-3 font-semibold">
              Módulos de Comando
            </span>
            <ul className="space-y-1">
              {navegacao.map((item) => {
                const ativo = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMenuAberto(false)}
                      className={`flex items-center gap-3 rounded-r-lg border-l-3 py-2.5 pl-3 pr-4 text-xs transition-all ${
                        ativo
                          ? "border-primary bg-primary-tint text-primary font-semibold shadow-2xs"
                          : "border-transparent text-ink-muted hover:bg-surface-sunken hover:text-ink"
                      }`}
                    >
                      <span className="text-sm opacity-80">{item.icone}</span>
                      <span>{item.rotulo}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="border-t border-line pt-5 space-y-3">
          <div className="flex items-center gap-2 text-xs text-primary font-medium">
            <span className="h-2 w-2 rounded-full bg-primary-base" />
            <span>Sincronizado ao vivo · TSE</span>
          </div>

          <div className="rounded-lg bg-surface-sunken p-2.5 border border-line text-[0.72rem] text-ink-muted leading-snug">
            Comitê Digital · Plataforma de Gestão & Conformidade Eleitoral.
          </div>

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-primary transition-colors pt-1 font-medium"
          >
            <span>← Encerrar sessão</span>
          </Link>
        </div>
      </aside>

      {/* Overlay mobile */}
      {menuAberto && (
        <div
          className="fixed inset-0 z-40 bg-ink/40 md:hidden backdrop-blur-xs"
          onClick={() => setMenuAberto(false)}
        />
      )}

      {/* Área Principal de Trabalho */}
      <div className="flex min-w-0 flex-1 flex-col bg-canvas">
        <header className="hidden md:flex items-center justify-between border-b border-line bg-surface/95 px-8 py-3.5 backdrop-blur-md sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-ink">
              Comitê Digital · Sistema de Gestão e Governança
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success-tint px-2.5 py-0.5 text-[0.65rem] font-mono font-semibold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              RLS ATIVO & SEGURO
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-ink">
            <SeletorTema />
            <div className="flex items-center gap-2.5 border-l border-line pl-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-tint text-[0.7rem] font-bold text-primary border border-primary/20">
                CD
              </span>
              <span>
                Operando: <strong className="text-ink font-semibold">Coordenação Geral</strong>{" "}
                <span className="text-ink-muted font-mono text-[0.7rem]">(Gestor)</span>
              </span>
            </div>
            <Link
              href="/login"
              className="text-xs text-ink-muted hover:text-primary hover:underline border-l border-line pl-4 font-medium"
            >
              Sair
            </Link>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 overflow-y-auto bg-canvas text-ink">
          {children}
        </main>
      </div>
    </div>
  );
}
