import type { ReactNode } from "react";

/**
 * O Registro — o elemento onde este passe visual gasta a ousadia.
 *
 * É um livro de registro pautado: cada linha é um fato que ficou gravado, com carimbo
 * de hora em mono (dado que a máquina confere) e o texto do evento em proporcional
 * (o que aconteceu, em linguagem de gente). Régua de margem à esquerda, hairline sob
 * cada linha. Sem card, sem sombra.
 *
 * `animar` liga o único movimento não pedido da interface: as linhas entram de cima
 * para baixo uma vez. Respeita prefers-reduced-motion.
 */
export function Registro({
  titulo,
  children,
  className = "",
}: {
  titulo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`regua ${className}`}>
      <h2 className="font-mono text-register tracking-wide text-ink-muted">{titulo}</h2>
      <ol className="mt-3 border-t border-line">{children}</ol>
    </section>
  );
}

function Linha({
  hora,
  sujeito,
  evento,
  estado,
  animar = false,
  ordem = 0,
}: {
  hora: string;
  sujeito?: string;
  evento: string;
  estado?: "confirmado" | "pendente" | "recusado";
  animar?: boolean;
  ordem?: number;
}) {
  const marca =
    estado === "confirmado" ? "text-seal" : estado === "recusado" ? "text-alert" : "text-ink-muted";

  return (
    <li
      className={`grid grid-cols-[4rem_1fr] items-baseline gap-x-3 gap-y-1 border-b border-line py-2.5 sm:grid-cols-[4rem_9rem_1fr] ${
        animar ? "registro-linha" : ""
      }`}
      style={animar ? { animationDelay: `${ordem * 90}ms` } : undefined}
    >
      <span className="font-mono text-register text-ink-muted tabular-nums">{hora}</span>
      <span className="text-small text-ink sm:truncate">{sujeito ?? ""}</span>
      <span className={`text-small ${marca}`}>{evento}</span>
    </li>
  );
}

Registro.Linha = Linha;
