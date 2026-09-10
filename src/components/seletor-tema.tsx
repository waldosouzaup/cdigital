"use client";

import { useEffect, useState } from "react";

export function SeletorTema({ className = "" }: { className?: string }) {
  const [tema, setTema] = useState<"light" | "dark">("light");
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
    const salvo = localStorage.getItem("cd-theme");
    if (salvo === "dark" || salvo === "light") {
      setTema(salvo);
      document.documentElement.dataset.theme = salvo;
      document.documentElement.classList.toggle("dark", salvo === "dark");
    } else {
      const temaAtual = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      setTema(temaAtual);
    }
  }, []);

  function alternarTema() {
    const proximoTema = tema === "light" ? "dark" : "light";
    setTema(proximoTema);
    document.documentElement.dataset.theme = proximoTema;
    document.documentElement.classList.toggle("dark", proximoTema === "dark");
    try {
      localStorage.setItem("cd-theme", proximoTema);
    } catch {
      // Ignora restrições de armazenamento local em iframes ou modo restrito
    }
  }

  if (!montado) {
    return (
      <div
        className={`h-8 w-8 rounded-full border border-line bg-surface flex items-center justify-center opacity-40 ${className}`}
        aria-hidden="true"
      />
    );
  }

  const ehEscuro = tema === "dark";

  return (
    <button
      type="button"
      onClick={alternarTema}
      title={ehEscuro ? "Alternar para tema claro" : "Alternar para tema escuro"}
      aria-label={ehEscuro ? "Alternar para tema claro" : "Alternar para tema escuro"}
      className={`inline-flex items-center justify-center h-8 w-8 rounded-full border border-line bg-surface text-ink-muted hover:text-ink hover:border-line-strong hover:bg-surface-sunken transition-all cursor-pointer shadow-2xs ${className}`}
    >
      {ehEscuro ? (
        // Ícone de Sol elegante (para voltar ao claro)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 text-accent"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ) : (
        // Ícone de Lua elegante (para ir ao escuro)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 text-ink-muted"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </button>
  );
}
