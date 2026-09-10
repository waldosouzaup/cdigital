import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Botão institucional do Design System (§7.1).
 * Vozeamento e hierarquia visual:
 * - "selo" / "primary": ação principal da tela (verde green-700 sólido).
 * - "verde" / "secundario": ação secundária contornada em verde.
 * - "linha" / "ghost": ação terciária sutil / cancelar.
 * - "destaque" / "amarelo": acento lime (raro, 1 CTA de campanha).
 * - "perigo": ação destrutiva confirmada (distrato, expurgo).
 * - "neutro": ação de baixa ênfase / filtro.
 */
export type VozSelo =
  | "selo"
  | "primary"
  | "amarelo"
  | "destaque"
  | "verde"
  | "secundario"
  | "linha"
  | "ghost"
  | "perigo"
  | "neutro";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  voz?: VozSelo;
  carregando?: boolean;
  textoCarregando?: string;
  icone?: ReactNode;
};

const base =
  "inline-flex items-center justify-center gap-2 text-small font-semibold rounded-lg transition-all duration-150 ease-out disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

const vozes: Record<VozSelo, string> = {
  selo: "bg-primary px-5 py-2.5 text-white font-medium shadow-xs hover:bg-primary-hover active:scale-[0.98]",
  primary:
    "bg-primary px-5 py-2.5 text-white font-medium shadow-xs hover:bg-primary-hover active:scale-[0.98]",
  verde:
    "border border-primary text-primary bg-surface px-5 py-2.5 font-medium hover:bg-primary-tint active:scale-[0.98]",
  secundario:
    "border border-primary text-primary bg-surface px-5 py-2.5 font-medium hover:bg-primary-tint active:scale-[0.98]",
  linha: "text-ink hover:bg-surface-sunken py-2 px-3 active:opacity-80 font-medium",
  ghost: "text-ink hover:bg-surface-sunken py-2 px-3 active:opacity-80 font-medium",
  destaque:
    "bg-accent px-5 py-2.5 text-ink-strong font-bold shadow-xs hover:opacity-95 active:scale-[0.98]",
  amarelo:
    "bg-accent px-5 py-2.5 text-ink-strong font-bold shadow-xs hover:opacity-95 active:scale-[0.98]",
  perigo:
    "bg-danger px-4 py-2.5 text-white shadow-xs hover:brightness-110 active:scale-[0.98] font-medium",
  neutro:
    "border border-line bg-surface px-4 py-2.5 text-ink-muted shadow-xs hover:bg-surface-sunken hover:text-ink active:scale-[0.98] font-medium",
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
