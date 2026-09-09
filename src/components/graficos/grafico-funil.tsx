"use client";

/**
 * Visualização de Funil de Mobilização e Contratação.
 *
 * Exibe a conversão passo a passo e calcula as perdas/gargalos em cada transição,
 * permitindo ao gestor intervir com precisão cirúrgica no ponto de estagnação.
 */

export type EtapaFunil = {
  nome: string;
  contagem: number;
  subtitulo: string;
  tempoMedio?: string;
  gargalo?: boolean;
};

export function GraficoFunil({
  etapas,
  className = "",
}: {
  etapas: EtapaFunil[];
  className?: string;
}) {
  const maximo = Math.max(...etapas.map((e) => e.contagem), 1);

  return (
    <div className={`space-y-6 border border-line bg-surface p-6 ${className}`}>
      <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-seal">
            Conversão & Eficiência Operacional
          </span>
          <h3 className="text-h2 font-semibold text-ink">Funil de Formalização da Equipe</h3>
        </div>
        <span className="text-xs text-ink-muted font-mono">
          Eficácia Geral:{" "}
          <strong className="text-success font-semibold">
            {((etapas[etapas.length - 1].contagem / etapas[0].contagem) * 100).toFixed(1)}%
          </strong>
        </span>
      </div>

      <div className="space-y-4">
        {etapas.map((etapa, idx) => {
          const percentualAbsoluto = ((etapa.contagem / maximo) * 100).toFixed(0);
          const anterior = etapas[idx - 1];
          const conversaoEtapa = anterior
            ? ((etapa.contagem / anterior.contagem) * 100).toFixed(1)
            : null;
          const perda = anterior ? anterior.contagem - etapa.contagem : 0;

          return (
            <div key={etapa.nome} className="space-y-1.5">
              <div className="flex items-baseline justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[0.7rem] font-bold text-ink-muted">
                    0{idx + 1}.
                  </span>
                  <span className="font-medium text-ink text-small">{etapa.nome}</span>
                  {etapa.gargalo && (
                    <span className="px-1.5 py-0.5 bg-alert/10 text-alert border border-alert/30 text-[0.65rem] font-mono font-semibold">
                      GARGALO ATIVO
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {conversaoEtapa && (
                    <span className="text-[0.7rem] font-mono text-ink-muted">
                      Taxa: <strong className="text-ink">{conversaoEtapa}%</strong>
                      {perda > 0 && <span className="text-alert ml-1">(-{perda})</span>}
                    </span>
                  )}
                  <span className="font-mono font-semibold text-ink text-small tabular-nums">
                    {etapa.contagem} pessoas
                  </span>
                </div>
              </div>

              {/* Barra do Funil */}
              <div className="h-3 w-full bg-line/60 rounded-none overflow-hidden relative">
                <div
                  className="h-full transition-all duration-500 ease-out"
                  style={{
                    width: `${percentualAbsoluto}%`,
                    backgroundColor: etapa.gargalo
                      ? "var(--color-alert)"
                      : idx === etapas.length - 1
                        ? "var(--color-success)"
                        : "var(--color-seal)",
                  }}
                />
              </div>

              <div className="flex justify-between text-[0.7rem] text-ink-muted">
                <span>{etapa.subtitulo}</span>
                {etapa.tempoMedio && (
                  <span className="font-mono">Tempo médio: {etapa.tempoMedio}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
