"use client";

import { useMemo, useState } from "react";
import {
  computarRelatorioIdade,
  type ItemPessoaIdade,
} from "@/lib/pessoas/relatorio-idade";

export function RelatorioIdadeSecao({
  pessoas,
  aoFiltrarNaLista,
  aoFechar,
}: {
  pessoas: ItemPessoaIdade[];
  aoFiltrarNaLista?: (funcao: string, regiao: string) => void;
  aoFechar?: () => void;
}) {
  const [filtroFuncao, setFiltroFuncao] = useState("todas");
  const [filtroRegiao, setFiltroRegiao] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "contratados" | "aptos">("todos");
  const [copiado, setCopiado] = useState(false);

  // Filtra as pessoas de acordo com a situação de contratação/aptidão antes de agregar
  const pessoasConsideradas = useMemo(() => {
    return pessoas.filter((p) => {
      if (filtroStatus === "aptos") {
        // @ts-expect-error apta pode vir em PessoaListada
        return Boolean(p.apta);
      }
      if (filtroStatus === "contratados") {
        // @ts-expect-error statusContrato pode vir em PessoaListada
        const status = p.statusContrato;
        return status === "emitido" || status === "enviado" || status === "assinado";
      }
      return true;
    });
  }, [pessoas, filtroStatus]);

  // Executa o cálculo puro da agregação demográfica
  const relatorio = useMemo(() => {
    return computarRelatorioIdade(pessoasConsideradas, {
      funcao: filtroFuncao,
      regiao: filtroRegiao,
    });
  }, [pessoasConsideradas, filtroFuncao, filtroRegiao]);

  function copiarResumoTexto() {
    if (!relatorio) return;
    const linhasTexto = relatorio.linhas.map(
      (l) =>
        `- ${l.funcao} em ${l.regiaoNome}: ${l.totalTrabalhadores} pessoa(s), média ${l.mediaIdade !== null ? `${l.mediaIdade} anos` : "N/D"} (mín: ${l.idadeMinima ?? "—"}, máx: ${l.idadeMaxima ?? "—"})`,
    );

    const texto = [
      `RELATÓRIO DEMOGRÁFICO: MÉDIA DE IDADE POR FUNÇÃO E REGIÃO`,
      `Total de colaboradores analisados: ${relatorio.totalGeralTrabalhadores} (${relatorio.totalGeralComIdade} com idade informada)`,
      `Média geral de idade: ${relatorio.mediaGeralIdade !== null ? `${relatorio.mediaGeralIdade} anos` : "N/D"}`,
      `Faixa etária geral: ${relatorio.idadeMinimaGeral ?? "—"} a ${relatorio.idadeMaximaGeral ?? "—"} anos`,
      ``,
      `Detalhamento por Função e Região:`,
      ...linhasTexto,
    ].join("\n");

    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  }

  function exportarCsv() {
    const cabecalho = "Funcao;Regiao;Total Colaboradores;Com Idade Informada;Media Idade;Idade Minima;Idade Maxima;Ate 25 anos;26 a 40 anos;41 a 55 anos;Acima de 55 anos\n";
    const linhasCsv = relatorio.linhas
      .map((l) =>
        [
          `"${l.funcao}"`,
          `"${l.regiaoNome}"`,
          l.totalTrabalhadores,
          l.totalComIdade,
          l.mediaIdade ?? "",
          l.idadeMinima ?? "",
          l.idadeMaxima ?? "",
          l.faixas.ate25,
          l.faixas.de26a40,
          l.faixas.de41a55,
          l.faixas.acima55,
        ].join(";"),
      )
      .join("\n");

    const blob = new Blob([cabecalho + linhasCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-media-idade-equipe-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="bg-surface border border-line rounded-lg p-5 space-y-5 shadow-xs transition-all">
      {/* Cabeçalho do Relatório */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-primary font-semibold">
              Análise Demográfica da Equipe
            </span>
            <span className="text-xs bg-primary-tint text-primary px-2 py-0.5 rounded-full font-medium">
              Estatísticas de Idade
            </span>
          </div>
          <h2 className="text-h2 font-semibold text-ink mt-1">
            Relatório de Média de Idade por Função e Região
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Mapeamento da faixa etária e perfil dos trabalhadores contratados para planejamento operacional e de campo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copiarResumoTexto}
            className="text-xs font-medium text-ink bg-surface-sunken hover:bg-line px-3 py-1.5 rounded transition-colors cursor-pointer"
            title="Copiar dados formatados para colar no WhatsApp ou documento"
          >
            {copiado ? "✓ Copiado!" : "Copiar resumo"}
          </button>
          <button
            type="button"
            onClick={exportarCsv}
            className="text-xs font-medium text-primary hover:text-ink bg-primary-tint/30 hover:bg-primary-tint/50 px-3 py-1.5 rounded transition-colors cursor-pointer"
            title="Baixar planilha CSV"
          >
            Exportar CSV
          </button>
          {aoFechar && (
            <button
              type="button"
              onClick={aoFechar}
              className="text-xs text-ink-muted hover:text-ink p-1.5 rounded hover:bg-surface-sunken cursor-pointer transition-colors"
              title="Ocultar painel de média de idade"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros Específicos do Relatório */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-surface-sunken/60 p-3.5 border border-line rounded-md text-small">
        {/* Filtro por Função */}
        <div>
          <label htmlFor="filtro-funcao-idade" className="block text-xs font-medium text-ink mb-1">
            Filtrar por Função:
          </label>
          <select
            id="filtro-funcao-idade"
            value={filtroFuncao}
            onChange={(e) => setFiltroFuncao(e.target.value)}
            className="w-full border-b border-line bg-surface py-1.5 px-2 text-xs text-ink outline-none focus:border-primary cursor-pointer rounded-xs [&>option]:bg-surface [&>option]:text-ink"
          >
            <option value="todas">Todas as funções ({relatorio.funcoesDisponiveis.length})</option>
            {relatorio.funcoesDisponiveis.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por Região */}
        <div>
          <label htmlFor="filtro-regiao-idade" className="block text-xs font-medium text-ink mb-1">
            Filtrar por Região:
          </label>
          <select
            id="filtro-regiao-idade"
            value={filtroRegiao}
            onChange={(e) => setFiltroRegiao(e.target.value)}
            className="w-full border-b border-line bg-surface py-1.5 px-2 text-xs text-ink outline-none focus:border-primary cursor-pointer rounded-xs [&>option]:bg-surface [&>option]:text-ink"
          >
            <option value="todas">Todas as regiões ({relatorio.regioesDisponiveis.length})</option>
            {relatorio.regioesDisponiveis.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por Situação / Status */}
        <div>
          <label htmlFor="filtro-situacao-idade" className="block text-xs font-medium text-ink mb-1">
            Situação Contratual / Documental:
          </label>
          <select
            id="filtro-situacao-idade"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as "todos" | "contratados" | "aptos")}
            className="w-full border-b border-line bg-surface py-1.5 px-2 text-xs text-ink outline-none focus:border-primary cursor-pointer rounded-xs [&>option]:bg-surface [&>option]:text-ink"
          >
            <option value="todos">Todos os colaboradores cadastrados</option>
            <option value="contratados">Apenas colaboradores contratados (quadro ativo)</option>
            <option value="aptos">Apenas colaboradores com documentação apta</option>
          </select>
        </div>
      </div>

      {/* Cards de Resumo Demográfico (KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Média Geral */}
        <div className="bg-surface-sunken p-3.5 border border-line rounded">
          <div className="text-xs text-ink-muted">Média Geral de Idade</div>
          <div className="font-mono text-2xl font-bold text-ink mt-1">
            {relatorio.mediaGeralIdade !== null ? `${relatorio.mediaGeralIdade}` : "—"}
            {relatorio.mediaGeralIdade !== null && (
              <span className="text-xs font-normal text-ink-muted ml-1">anos</span>
            )}
          </div>
          <div className="text-[0.7rem] text-ink-muted mt-0.5">
            com base na amostra selecionada
          </div>
        </div>

        {/* Faixa Etária */}
        <div className="bg-surface-sunken p-3.5 border border-line rounded">
          <div className="text-xs text-ink-muted">Faixa Etária (Mín / Máx)</div>
          <div className="font-mono text-lg font-bold text-ink mt-1">
            {relatorio.idadeMinimaGeral !== null ? `${relatorio.idadeMinimaGeral}` : "—"}
            <span className="text-xs text-ink-muted mx-1">a</span>
            {relatorio.idadeMaximaGeral !== null ? `${relatorio.idadeMaximaGeral}` : "—"}
            <span className="text-xs font-normal text-ink-muted ml-1">anos</span>
          </div>
          <div className="text-[0.7rem] text-ink-muted mt-0.5">
            amplitude etária dos colaboradores
          </div>
        </div>

        {/* Amostra Analisada */}
        <div className="bg-surface-sunken p-3.5 border border-line rounded">
          <div className="text-xs text-ink-muted">Colaboradores Analisados</div>
          <div className="font-mono text-2xl font-bold text-ink mt-1">
            {relatorio.totalGeralTrabalhadores}
          </div>
          <div className="text-[0.7rem] text-ink-muted mt-0.5">
            {relatorio.totalGeralComIdade} com data de nascimento
          </div>
        </div>

        {/* Distribuição Geral */}
        <div className="bg-surface-sunken p-3.5 border border-line rounded">
          <div className="text-xs text-ink-muted">Distribuição por Faixas</div>
          <div className="flex items-center gap-1 mt-2 text-[0.7rem] font-mono text-ink">
            <span title="Até 25 anos" className="bg-blue-500/20 text-blue-400 px-1 py-0.5 rounded">
              ≤25: {relatorio.faixasGerais.ate25}
            </span>
            <span title="26 a 40 anos" className="bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded">
              26-40: {relatorio.faixasGerais.de26a40}
            </span>
            <span title="41 a 55 anos" className="bg-amber-500/20 text-amber-400 px-1 py-0.5 rounded">
              41-55: {relatorio.faixasGerais.de41a55}
            </span>
            <span title="Acima de 55 anos" className="bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded">
              &gt;55: {relatorio.faixasGerais.acima55}
            </span>
          </div>
          <div className="text-[0.7rem] text-ink-muted mt-1">
            faixas etárias dos trabalhadores
          </div>
        </div>
      </div>

      {/* Tabela do Relatório: Função × Região */}
      {relatorio.linhas.length > 0 ? (
        <div className="overflow-x-auto border border-line rounded">
          <table className="w-full border-collapse text-left text-small">
            <thead>
              <tr className="border-b border-line bg-surface-sunken font-mono text-xs text-ink-muted">
                <th className="p-3">Função</th>
                <th className="p-3">Região</th>
                <th className="p-3 text-center">Trabalhadores</th>
                <th className="p-3 text-center">Média de Idade</th>
                <th className="p-3 text-center">Mín. / Máx.</th>
                <th className="p-3 text-center">Distribuição Etária</th>
                {aoFiltrarNaLista && <th className="p-3 text-right">Filtrar</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {relatorio.linhas.map((linha, idx) => {
                const totalFaixas = linha.totalComIdade || 1;
                const p25 = Math.round((linha.faixas.ate25 / totalFaixas) * 100);
                const p40 = Math.round((linha.faixas.de26a40 / totalFaixas) * 100);
                const p55 = Math.round((linha.faixas.de41a55 / totalFaixas) * 100);
                const pAcima = Math.round((linha.faixas.acima55 / totalFaixas) * 100);

                return (
                  <tr key={`${linha.funcao}-${linha.regiaoNome}-${idx}`} className="hover:bg-surface-sunken/50 transition-colors">
                    <td className="p-3 font-medium text-ink">{linha.funcao}</td>
                    <td className="p-3 text-ink-muted">{linha.regiaoNome}</td>
                    <td className="p-3 text-center font-mono">
                      <span className="font-semibold text-ink">{linha.totalTrabalhadores}</span>
                      {linha.totalComIdade < linha.totalTrabalhadores && (
                        <span className="text-[0.7rem] text-ink-muted ml-1" title={`${linha.totalComIdade} com idade informada`}>
                          ({linha.totalComIdade})
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono">
                      {linha.mediaIdade !== null ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-tint text-primary">
                          {linha.mediaIdade} anos
                        </span>
                      ) : (
                        <span className="text-xs text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono text-xs text-ink-muted">
                      {linha.idadeMinima !== null && linha.idadeMaxima !== null ? (
                        <span>{linha.idadeMinima} a {linha.idadeMaxima}</span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {linha.totalComIdade > 0 ? (
                        <div className="w-28 mx-auto flex h-2 rounded-full overflow-hidden bg-surface-sunken" title={`≤25: ${p25}%, 26-40: ${p40}%, 41-55: ${p55}%, >55: ${pAcima}%`}>
                          {p25 > 0 && <div style={{ width: `${p25}%` }} className="bg-blue-400" />}
                          {p40 > 0 && <div style={{ width: `${p40}%` }} className="bg-emerald-400" />}
                          {p55 > 0 && <div style={{ width: `${p55}%` }} className="bg-amber-400" />}
                          {pAcima > 0 && <div style={{ width: `${pAcima}%` }} className="bg-purple-400" />}
                        </div>
                      ) : (
                        <span className="text-[0.7rem] text-ink-muted">Sem dados</span>
                      )}
                    </td>
                    {aoFiltrarNaLista && (
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => aoFiltrarNaLista(linha.funcao, linha.regiaoNome)}
                          className="text-xs text-primary hover:underline font-medium cursor-pointer"
                          title="Filtrar tabela de pessoas abaixo por esta Função e Região"
                        >
                          Ver pessoas ↓
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-6 text-center text-xs text-ink-muted border border-line rounded bg-surface-sunken">
          Nenhum colaborador encontrado para os filtros selecionados.
        </div>
      )}
    </section>
  );
}
