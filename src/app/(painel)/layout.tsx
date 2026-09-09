"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Marca } from "@/components/marca";

const navegacao = [
  { rotulo: "Painel Geral", href: "/dashboard", icone: "⊞" },
  { rotulo: "Equipe / Pessoas", href: "/pessoas", icone: "👥" },
  { rotulo: "Equipe / Acessos", href: "/equipe", icone: "🔑" },
  { rotulo: "Regiões de Atuação", href: "/regioes", icone: "🗺" },
  { rotulo: "Contratos & Vigor", href: "/contratos", icone: "📄" },
  { rotulo: "Conferência de Documentos", href: "/documentos", icone: "🔍" },
  { rotulo: "Atividades de Rua", href: "/atividades", icone: "📌" },
  { rotulo: "Configurações & Modelos", href: "/configuracoes", icone: "⚙" },
];

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-[#070d18] text-slate-100">
      {/* Barra superior Mobile */}
      <header className="flex md:hidden items-center justify-between border-b border-[#1e3256] bg-[#070d18] px-4 py-3 text-white sticky top-0 z-40">
        <Marca className="text-white" subtitulo="" />
        <button
          type="button"
          onClick={() => setMenuAberto(!menuAberto)}
          className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-mono text-slate-300 hover:text-white"
        >
          {menuAberto ? "✕ FECHAR" : "☰ MENU"}
        </button>
      </header>

      {/* Menu Lateral / Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col justify-between border-r border-[#162540] bg-[#070d18] px-5 py-6 text-slate-200 transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          menuAberto ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div>
          <div className="hidden md:block pb-6 border-b border-slate-800/80">
            <Marca className="text-white" subtitulo="Sistema de Gestão" />
          </div>

          <nav className="mt-6 md:mt-8">
            <span className="block text-[0.68rem] font-mono tracking-wider text-slate-400 uppercase mb-3 px-3 font-semibold">
              Módulos de Comando
            </span>
            <ul className="space-y-1.5">
              {navegacao.map((item) => {
                const ativo = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMenuAberto(false)}
                      className={`flex items-center gap-3 rounded-r-lg border-l-3 py-2.5 pl-3 pr-4 text-xs font-medium transition-all ${
                        ativo
                          ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow font-bold shadow-xs"
                          : "border-transparent text-slate-400 hover:border-slate-600 hover:bg-slate-900/60 hover:text-slate-100"
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

        <div className="border-t border-slate-800/80 pt-5 space-y-3">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Sincronizado ao vivo · TSE</span>
          </div>

          <div className="rounded-lg bg-slate-900/70 p-2.5 border border-slate-800 text-[0.72rem] text-slate-400 leading-snug">
            Comitê Digital · Plataforma de Gestão & Conformidade Eleitoral.
          </div>

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-yellow transition pt-1"
          >
            <span>← Encerrar sessão</span>
          </Link>
        </div>
      </aside>

      {/* Overlay mobile */}
      {menuAberto && (
        <div
          className="fixed inset-0 z-40 bg-black/70 md:hidden backdrop-blur-xs"
          onClick={() => setMenuAberto(false)}
        />
      )}

      {/* Área Principal de Trabalho */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#070d18]">
        <header className="hidden md:flex items-center justify-between border-b border-[#162540] bg-[#0c1628]/90 px-8 py-3.5 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Comitê Digital · Sistema de Gestão e Governança
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[0.65rem] font-mono font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              RLS ATIVO & SEGURO
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-300">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-yellow text-[0.7rem] font-black text-slate-950">
                MS
              </span>
              <span>
                Operando: <strong className="text-white font-semibold">Maria Salgado</strong>{" "}
                <span className="text-slate-400 font-mono text-[0.7rem]">(Gestora Geral)</span>
              </span>
            </div>
            <Link
              href="/login"
              className="text-xs text-brand-yellow hover:underline border-l border-slate-700 pl-4 font-semibold"
            >
              Sair
            </Link>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 overflow-y-auto bg-[#070d18] text-slate-100">
          {children}
        </main>
      </div>
    </div>
  );
}
