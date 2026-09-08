"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alerta } from "@/components/alerta";
import { Selo } from "@/components/selo";
import { EstadoVazio } from "@/components/estado-vazio";
import { lerPlanilhaPessoas } from "@/lib/pessoas/ler-planilha";
import type { LinhaClassificada, LinhaPlanilha } from "@/lib/pessoas/analisar-planilha";
import { conferirImportacao, gravarImportacao, type EstadoGravacao } from "./acoes";

type Analise = { validos: LinhaClassificada[]; duplicatas: LinhaClassificada[]; invalidos: LinhaClassificada[] };

function Tabela({ titulo, linhas, tom }: { titulo: string; linhas: LinhaClassificada[]; tom: string }) {
  if (linhas.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className={`text-small font-semibold ${tom}`}>
        {titulo} · {linhas.length}
      </h3>
      <div className="mt-2 overflow-x-auto border border-line">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-line bg-surface/60 font-mono text-ink-muted">
              <th className="p-2">Linha</th>
              <th className="p-2">Nome</th>
              <th className="p-2">CPF</th>
              <th className="p-2">Região</th>
              <th className="p-2">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {linhas.map((l) => (
              <tr key={l.linha}>
                <td className="p-2 font-mono">{l.linha}</td>
                <td className="p-2 text-ink">{l.nomeCompleto || "—"}</td>
                <td className="p-2 font-mono text-ink-muted">{l.cpf || "—"}</td>
                <td className="p-2 text-ink-muted">{l.regiao || "—"}</td>
                <td className="p-2 text-ink-muted">{l.motivo ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ImportarCliente() {
  const router = useRouter();
  const [processando, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [linhasLidas, setLinhasLidas] = useState<LinhaPlanilha[]>([]);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [gravacao, setGravacao] = useState<EstadoGravacao | null>(null);

  async function aoEscolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro(null);
    setAnalise(null);
    setGravacao(null);

    let linhas: LinhaPlanilha[];
    try {
      linhas = await lerPlanilhaPessoas(await arquivo.arrayBuffer());
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível ler a planilha.");
      return;
    }
    if (linhas.length === 0) {
      setErro("A planilha não tem nenhuma linha de dados abaixo do cabeçalho.");
      return;
    }
    setLinhasLidas(linhas);

    iniciar(async () => {
      const resposta = await conferirImportacao(linhas);
      if (resposta.status === "ok" && resposta.resultado) setAnalise(resposta.resultado);
      else setErro(resposta.mensagem ?? "Não foi possível conferir a planilha.");
    });
  }

  function gravar() {
    setGravacao(null);
    iniciar(async () => {
      const resposta = await gravarImportacao(linhasLidas);
      setGravacao(resposta);
      if (resposta.status === "ok") router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="regua border-b border-line pb-4">
        <h1 className="text-h1 font-semibold text-ink">Importar cadastro em lote</h1>
        <p className="mt-1 text-small text-ink-muted">
          Suba uma planilha .xlsx com as colunas <strong>nome</strong> e <strong>cpf</strong>{" "}
          (opcionais: telefone, região, função). Nada é gravado até você conferir e confirmar.
        </p>
        <Link
          href="/pessoas"
          className="mt-2 inline-block text-small font-medium text-seal underline decoration-seal/40 underline-offset-4"
        >
          ← Voltar para o quadro de pessoas
        </Link>
      </header>

      <label className="block text-small font-medium text-ink">
        Planilha de cadastro
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={aoEscolherArquivo}
          disabled={processando}
          className="mt-1.5 block w-full text-xs text-ink-muted file:mr-3 file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-xs file:text-ink"
        />
      </label>

      {processando && <p className="font-mono text-xs text-ink-muted">Conferindo…</p>}
      {erro && <Alerta tom="critico" titulo="Não foi possível importar">{erro}</Alerta>}

      {analise && (
        <section>
          <Alerta
            tom={analise.validos.length > 0 ? "informativo" : "atencao"}
            titulo="Conferência da planilha"
          >
            {analise.validos.length} prontas para gravar · {analise.duplicatas.length} duplicatas ·{" "}
            {analise.invalidos.length} ilegíveis. Só as prontas serão gravadas.
          </Alerta>

          <Tabela titulo="Duplicatas (não serão gravadas)" linhas={analise.duplicatas} tom="text-warning" />
          <Tabela titulo="Ilegíveis (não serão gravadas)" linhas={analise.invalidos} tom="text-alert" />
          <Tabela titulo="Prontas para gravar" linhas={analise.validos} tom="text-success" />

          {analise.validos.length === 0 ? (
            <div className="mt-4">
              <EstadoVazio
                titulo="Nenhuma linha pronta para gravar"
                descricao="Corrija as duplicatas e as linhas ilegíveis na planilha e suba de novo."
              />
            </div>
          ) : (
            <div className="mt-5">
              <Selo voz="selo" onClick={gravar} carregando={processando} disabled={processando}>
                Gravar {analise.validos.length} pessoa(s)
              </Selo>
            </div>
          )}
        </section>
      )}

      {gravacao?.status === "ok" && (
        <Alerta tom="sucesso" titulo="Importação concluída">
          {gravacao.gravados} pessoa(s) gravada(s).
          {gravacao.falhas && gravacao.falhas.length > 0 && (
            <> {gravacao.falhas.length} linha(s) falharam na gravação: {gravacao.falhas.map((f) => f.linha).join(", ")}.</>
          )}{" "}
          <Link href="/pessoas" className="underline decoration-seal/40 underline-offset-4">
            Ver o quadro de pessoas
          </Link>
        </Alerta>
      )}
      {gravacao?.status === "erro" && (
        <Alerta tom="critico" titulo="Não foi possível gravar">{gravacao.mensagem}</Alerta>
      )}
    </div>
  );
}
