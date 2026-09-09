import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Botão institucional. Quatro vozes:
 * - "selo": ação que confirma ou avança um estado (fundo cor de selo, texto claro).
 * - "linha": ação secundária sutil (texto sublinhado na cor de selo).
 * - "perigo": ação destrutiva ou de rescisão (fundo tijolo/alerta).
 * - "neutro": ação auxiliar contornada (fundo transparente com borda hairline).
 *
 * Respeita foco acessível e sensação de carimbo físico (active:translate-y-px).
 */
export type VozSelo = "selo" | "amarelo" | "verde" | "linha" | "perigo" | "neutro";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  voz?: VozSelo;
  carregando?: boolean;
  textoCarregando?: string;
  icone?: ReactNode;
};

const base =
  "inline-flex items-center justify-center gap-2 text-small font-semibold rounded-full transition-all duration-150 ease-out disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow";

const vozes: Record<VozSelo, string> = {
  selo: "bg-brand-yellow px-5 py-2 text-slate-950 font-bold shadow-xs hover:bg-brand-yellow-hover active:scale-[0.98] ring-1 ring-brand-yellow/60",
  amarelo:
    "bg-brand-yellow px-5 py-2 text-slate-950 font-bold shadow-xs hover:bg-brand-yellow-hover active:scale-[0.98] ring-1 ring-brand-yellow/60",
  verde:
    "bg-brand-green px-5 py-2 text-white font-bold shadow-xs hover:bg-brand-green/90 active:scale-[0.98] ring-1 ring-white/20",
  linha:
    "text-brand-yellow underline decoration-brand-yellow/50 underline-offset-4 hover:decoration-brand-yellow hover:text-brand-yellow/90 py-1.5 px-2 active:opacity-80 font-medium",
  perigo:
    "bg-alert px-4 py-2 text-white shadow-xs ring-1 ring-inset ring-alert/40 hover:brightness-110 active:scale-[0.98] active:translate-y-px font-medium",
  neutro:
    "border border-line bg-surface/70 px-4 py-2 text-ink shadow-xs hover:bg-surface hover:border-ink/20 active:scale-[0.98] font-medium",
};

export function Selo({
  voz = "selo",
  carregando = false,
  textoCarregando = "Processando…",
  icone,
  className = "",
  type = "button",
  children,
  disabled,
  ...props
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || carregando}
      className={`${base} ${vozes[voz]} ${className}`}
      {...props}
    >
      {carregando ? (
        <>
          <span className="h-3.5 w-3.5 animate-spin border-2 border-current border-t-transparent rounded-full" />
          <span>{textoCarregando}</span>
        </>
      ) : (
        <>
          {icone && <span className="shrink-0">{icone}</span>}
          {children}
        </>
      )}
    </button>
  );
}
