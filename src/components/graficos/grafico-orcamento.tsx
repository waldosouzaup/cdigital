"use client";

/**
 * Visualização de Inteligência Financeira e Comprometimento de Verba (TSE).
 *
 * Exibe:
 * - Barra multi-segmentada com a proporção de cada categoria contratual.
 * - Indicador de consumo em relação ao teto legal da chapa.
 * - Detalhamento analítico de valores médios unitários.
 */

export type SegmentoOrcamento = {
  categoria: string;
  valorTotal: number;
  qtdContratos: number;
  cor: string;
};

export function GraficoOrcamento({
  tetoOrcamentario,
  segmentos,
  className = "",
}: {
  tetoOrcamentario: number;
  segmentos: SegmentoOrcamento[];
  className?: string;
}) {
  const totalComprometido = segmentos.reduce((acc, s) => acc + s.valorTotal, 0);
  const percentualComprometido = Math.min(
    Math.round((totalComprometido / tetoOrcamentario) * 100),
    100,
  );
  const saldoDisponivel = Math.max(tetoOrcamentario - totalComprometido, 0);

  return (
    <div className={`space-y-6 border border-line bg-surface p-6 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-line pb-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-seal">
            Finanças de Campanha · Prestação de Contas
          </span>
          <h3 className="text-h2 font-semibold text-ink">Comprometimento da Folha Temporária</h3>
        </div>
        <div className="text-right">
          <span className="text-xs text-ink-muted block">Teto Autorizado da Chapa</span>
          <span className="font-mono text-small font-semibold text-ink">
            R$ {tetoOrcamentario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Cards de Resumo Financeiro */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 border border-line bg-paper">
          <span className="text-xs text-ink-muted block">Total Comprometido em Contratos</span>
          <span className="font-mono text-2xl font-semibold text-ink">
            R$ {totalComprometido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[0.7rem] text-seal font-medium block mt-1">
            {percentualComprometido}% do teto alocado
          </span>
        </div>

        <div className="p-4 border border-line bg-paper">
          <span className="text-xs text-ink-muted block">Saldo Disponível para Contratações</span>
          <span className="font-mono text-2xl font-semibold text-success">
            R$ {saldoDisponivel.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[0.7rem] text-ink-muted block mt-1">
            Margem de segurança para reforço
          </span>
        </div>

        <div className="p-4 border border-line bg-paper">
          <span className="text-xs text-ink-muted block">Custo Médio por Colaborador</span>
          <span className="font-mono text-2xl font-semibold text-ink">
            R${" "}
            {(
              totalComprometido / (segmentos.reduce((acc, s) => acc + s.qtdContratos, 0) || 1)
            ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[0.7rem] text-ink-muted block mt-1">
            Média ponderada do quadro ativo
          </span>
        </div>
      </div>

      {/* Barra Multi-Segmentada Proporcional */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-ink-muted font-mono">
          <span>Distribuição por Categoria</span>
          <span>
            {percentualComprometido}% alocado / {100 - percentualComprometido}% livre
          </span>
        </div>

        <div className="h-4 w-full bg-line flex overflow-hidden border border-line">
          {segmentos.map((seg) => {
            const larguraPct = (seg.valorTotal / tetoOrcamentario) * 100;
            return (
              <div
                key={seg.categoria}
                title={`${seg.categoria}: R$ ${seg.valorTotal.toLocaleString("pt-BR")} (${larguraPct.toFixed(1)}%)`}
                className="h-full transition-all hover:opacity-85 cursor-help"
                style={{
                  width: `${larguraPct}%`,
                  backgroundColor: seg.cor,
                }}
              />
            );
          })}
          {/* Espaço restante (não alocado) */}
          <div
            className="h-full bg-line/40 flex-1"
            title={`Saldo livre: R$ ${saldoDisponivel.toLocaleString("pt-BR")}`}
          />
        </div>
      </div>

      {/* Legenda e Tabela Analítica de Custos */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-line text-ink-muted font-mono">
              <th className="pb-2">Função / Objeto</th>
              <th className="pb-2 text-center">Vagas</th>
              <th className="pb-2 text-right">Valor Alocado</th>
              <th className="pb-2 text-right">Participação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {segmentos.map((seg) => {
              const percShare = ((seg.valorTotal / totalComprometido) * 100).toFixed(1);
              return (
                <tr key={seg.categoria} className="hover:bg-paper/40 transition-colors">
                  <td className="py-2.5 font-medium text-ink flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.cor }} />
                    {seg.categoria}
                  </td>
                  <td className="py-2.5 text-center font-mono text-ink-muted">
                    {seg.qtdContratos}
                  </td>
                  <td className="py-2.5 text-right font-mono font-medium text-ink">
                    R$ {seg.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 text-right font-mono text-seal font-semibold">
                    {percShare}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
