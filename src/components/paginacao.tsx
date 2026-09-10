import type { ReactNode } from "react";

export interface PropsPaginacao {
  paginaAtual: number;
  totalItens: number;
  itensPorPagina: number;
  aoMudarPagina: (novaPagina: number) => void;
  opcoesItensPorPagina?: number[];
  aoMudarItensPorPagina?: (novosItensPorPagina: number) => void;
  rotuloItem?: string;
  rotuloItemPlural?: string;
}

/**
 * Gera a sequência de páginas com reticências ("...") para exibição elegante.
 * Se o total de páginas for pequeno (<= 7), exibe todas diretamente.
 */
export function gerarJanelaPaginas(
  paginaAtual: number,
  totalPaginas: number,
  margemAdjacente: number = 1,
): (number | "...")[] {
  if (totalPaginas <= 1) return [1];
  if (totalPaginas <= 7) {
    return Array.from({ length: totalPaginas }, (_, i) => i + 1);
  }

  const paginas: (number | "...")[] = [];
  const inicioMeio = Math.max(2, paginaAtual - margemAdjacente);
  const fimMeio = Math.min(totalPaginas - 1, paginaAtual + margemAdjacente);

  // Primeira página sempre
  paginas.push(1);

  // Reticências à esquerda, se houver espaço
  if (inicioMeio > 2) {
    paginas.push("...");
  }

  // Páginas centrais
  for (let i = inicioMeio; i <= fimMeio; i++) {
    paginas.push(i);
  }

  // Reticências à direita, se houver espaço
  if (fimMeio < totalPaginas - 1) {
    paginas.push("...");
  }

  // Última página sempre
  paginas.push(totalPaginas);

  return paginas;
}

export function Paginacao({
  paginaAtual,
  totalItens,
  itensPorPagina,
  aoMudarPagina,
  opcoesItensPorPagina = [10, 20, 50, 100],
  aoMudarItensPorPagina,
  rotuloItem = "registro",
  rotuloItemPlural = "registros",
}: PropsPaginacao) {
  const totalPaginas = Math.max(1, Math.ceil(totalItens / itensPorPagina));
  const de = totalItens === 0 ? 0 : (paginaAtual - 1) * itensPorPagina + 1;
  const ate = Math.min(paginaAtual * itensPorPagina, totalItens);

  const temAnterior = paginaAtual > 1;
  const temProxima = paginaAtual < totalPaginas;

  const janela = gerarJanelaPaginas(paginaAtual, totalPaginas);

  return (
    <nav
      aria-label="Navegação entre páginas"
      className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-line bg-surface/50 px-4 py-3 text-small text-ink-muted select-none"
    >
      {/* Resumo textual & seletor de quantidade */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <div>
          Exibindo <span className="font-mono font-semibold text-ink">{de}</span> a{" "}
          <span className="font-mono font-semibold text-ink">{ate}</span> de{" "}
          <span className="font-mono font-semibold text-ink">{totalItens}</span>{" "}
          {totalItens === 1 ? rotuloItem : rotuloItemPlural}
        </div>

        {aoMudarItensPorPagina && (
          <div className="flex items-center gap-1.5 border-l border-line pl-4">
            <label htmlFor="seletor-itens-por-pagina" className="text-ink-muted">
              Por página:
            </label>
            <select
              id="seletor-itens-por-pagina"
              value={itensPorPagina}
              onChange={(e) => aoMudarItensPorPagina(Number(e.target.value))}
              className="border border-line bg-surface px-2 py-0.5 font-mono text-xs text-ink outline-none focus:border-seal cursor-pointer rounded-xs"
            >
              {opcoesItensPorPagina.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Controles de Navegação */}
      <div className="flex items-center gap-1 text-xs">
        {/* Primeira página */}
        <BotaoNavegacao
          onClick={() => aoMudarPagina(1)}
          disabled={!temAnterior}
          titulo="Primeira página"
          ariaLabel="Ir para a primeira página"
        >
          «
        </BotaoNavegacao>

        {/* Página anterior */}
        <BotaoNavegacao
          onClick={() => aoMudarPagina(paginaAtual - 1)}
          disabled={!temAnterior}
          titulo="Página anterior"
          ariaLabel="Ir para a página anterior"
        >
          ‹ Anterior
        </BotaoNavegacao>

        {/* Janela de números de página para telas médias e grandes */}
        <div className="hidden sm:flex items-center gap-1">
          {janela.map((p, idx) => {
            if (p === "...") {
              return (
                <span
                  key={`reticencias-${idx}`}
                  className="px-2 py-1 font-mono text-ink-muted select-none"
                  aria-hidden="true"
                >
                  …
                </span>
              );
            }

            const ehAtual = p === paginaAtual;
            return (
              <button
                key={p}
                type="button"
                onClick={() => aoMudarPagina(p)}
                aria-current={ehAtual ? "page" : undefined}
                className={`min-w-[32px] h-8 px-2 font-mono text-xs rounded-xs border transition-colors cursor-pointer ${
                  ehAtual
                    ? "bg-primary border-primary text-white font-bold shadow-xs"
                    : "border-line bg-surface text-ink hover:bg-surface-sunken hover:border-line-strong"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Indicador simplificado para telas móveis */}
        <span className="sm:hidden font-mono text-xs px-2 text-ink">
          {paginaAtual} / {totalPaginas}
        </span>

        {/* Próxima página */}
        <BotaoNavegacao
          onClick={() => aoMudarPagina(paginaAtual + 1)}
          disabled={!temProxima}
          titulo="Próxima página"
          ariaLabel="Ir para a próxima página"
        >
          Próxima ›
        </BotaoNavegacao>

        {/* Última página */}
        <BotaoNavegacao
          onClick={() => aoMudarPagina(totalPaginas)}
          disabled={!temProxima}
          titulo="Última página"
          ariaLabel="Ir para a última página"
        >
          »
        </BotaoNavegacao>
      </div>
    </nav>
  );
}

function BotaoNavegacao({
  onClick,
  disabled,
  titulo,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  titulo: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titulo}
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center h-8 px-2.5 rounded-xs border border-line bg-surface text-ink hover:bg-surface-sunken hover:border-line-strong disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}
