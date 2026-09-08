"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alerta } from "@/components/alerta";
import { Campo } from "@/components/campo";
import { Selo } from "@/components/selo";
import { EstadoVazio } from "@/components/estado-vazio";
import { registrarAtividade } from "./acoes";
import type { PessoaOpcao, RegiaoOpcao, RegistroAtividadeListado } from "./dados";

// A coluna `registros_atividade.tipo` é texto livre — esta é uma lista curada de
// ações de campo comuns, com "Outra" liberando texto próprio. Escolha de UX,
// não requisito (registrado em CONSULTAS.md).
const TIPOS_ACAO = [
  "Panfletagem",
  "Montagem de cavaletes",
  "Caminhada / bandeiraço",
  "Mobilização de feira",
] as const;

const QUANTIAS_RAPIDAS = [50, 100, 500];

const LS_PESSOA = "atividade:ultimaPessoa";
const LS_TIPO = "atividade:ultimoTipo";

function lerLocal(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravarLocal(chave: string, valor: string): void {
  try {
    window.localStorage.setItem(chave, valor);
  } catch {
    // Janela anônima / storage bloqueado — o fluxo funciona sem lembrar a última escolha.
  }
}

export function AtividadesCliente({
  regioes,
  pessoas,
  registros,
}: {
  regioes: RegiaoOpcao[];
  pessoas: PessoaOpcao[];
  registros: RegistroAtividadeListado[];
}) {
  const router = useRouter();
  const [pendente, iniciarEnvio] = useTransition();

  const [pessoaId, setPessoaId] = useState("");
  const [tipoBase, setTipoBase] = useState<string>("");
  const [tipoOutra, setTipoOutra] = useState("");
  const [quantidade, setQuantidade] = useState(100);
  const [observacao, setObservacao] = useState("");
  const [mostrarObs, setMostrarObs] = useState(false);
  const [trocarPessoa, setTrocarPessoa] = useState(false);

  const [erros, setErros] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ tom: "sucesso" | "critico"; texto: string } | null>(null);

  // Recupera a última pessoa/tipo. Sem pessoa lembrada, já abre o seletor.
  useEffect(() => {
    const ultimaPessoa = lerLocal(LS_PESSOA);
    if (ultimaPessoa && pessoas.some((p) => p.id === ultimaPessoa)) {
      setPessoaId(ultimaPessoa);
    } else {
      setTrocarPessoa(true);
    }
    const ultimoTipo = lerLocal(LS_TIPO);
    if (ultimoTipo) {
      if ((TIPOS_ACAO as readonly string[]).includes(ultimoTipo)) {
        setTipoBase(ultimoTipo);
      } else {
        setTipoBase("__outra__");
        setTipoOutra(ultimoTipo);
      }
    }
  }, [pessoas]);

  const pessoa = useMemo(() => pessoas.find((p) => p.id === pessoaId) ?? null, [pessoas, pessoaId]);
  const regiaoNome = useMemo(
    () => regioes.find((r) => r.id === pessoa?.regiaoId)?.nome ?? null,
    [regioes, pessoa],
  );
  const tipo = tipoBase === "__outra__" ? tipoOutra.trim() : tipoBase;
  const podeEnviar = Boolean(pessoaId) && Boolean(tipo) && quantidade >= 1 && !pendente;

  function ajustarQuantidade(delta: number) {
    setQuantidade((q) => Math.max(1, q + delta));
  }

  function enviar() {
    setAviso(null);
    setErros({});
    iniciarEnvio(async () => {
      const resultado = await registrarAtividade({
        pessoaId,
        regiaoId: pessoa?.regiaoId ?? undefined,
        tipo,
        quantidade,
        observacao,
        data: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()),
      });

      if (resultado.status === "sucesso") {
        gravarLocal(LS_PESSOA, pessoaId);
        if (tipo) gravarLocal(LS_TIPO, tipo);
        setObservacao("");
        setMostrarObs(false);
        setAviso({ tom: "sucesso", texto: `${tipo} de ${pessoa?.nome ?? "—"} registrada.` });
        router.refresh();
      } else if (resultado.erros) {
        setErros(resultado.erros as Record<string, string>);
      } else {
        setAviso({ tom: "critico", texto: resultado.mensagem ?? "Não foi possível registrar." });
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg pb-28">
      <header className="regua border-b border-line pb-4">
        <h1 className="text-h1 font-semibold text-ink">Registrar atividade</h1>
        <p className="mt-1 text-small text-ink-muted">
          Três toques: tipo de ação, quantidade e registrar. A pessoa e a região ficam guardadas
          para o próximo.
        </p>
      </header>

      {/* Contexto: pessoa + região, lembrados do último registro */}
      <section className="mt-5">
        {trocarPessoa || !pessoa ? (
          <Campo.Selecao
            id="pessoa"
            rotulo="Quem executou a atividade"
            value={pessoaId}
            erro={erros.pessoaId}
            onChange={(e) => {
              setPessoaId(e.target.value);
              if (e.target.value) setTrocarPessoa(false);
            }}
          >
            <option value="">Selecione…</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Campo.Selecao>
        ) : (
          <div className="flex items-center justify-between border-b border-line pb-2">
            <div>
              <span className="block font-medium text-ink">{pessoa.nome}</span>
              <span className="block font-mono text-xs text-ink-muted">
                {regiaoNome ?? "região não informada"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTrocarPessoa(true)}
              className="text-small font-medium text-seal underline decoration-seal/40 underline-offset-4"
            >
              Trocar
            </button>
          </div>
        )}
      </section>

      {/* TOQUE 1 — tipo de ação */}
      <section className="mt-6">
        <span className="text-small font-medium text-ink">1 · Tipo de ação</span>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[...TIPOS_ACAO, "Outra"].map((t) => {
            const valor = t === "Outra" ? "__outra__" : t;
            const ativo = tipoBase === valor;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={ativo}
                onClick={() => setTipoBase(valor)}
                className={`min-h-14 rounded border px-3 py-2 text-left text-small transition-colors ${
                  ativo
                    ? "border-seal bg-seal/15 font-semibold text-ink"
                    : "border-line bg-surface/60 text-ink-muted hover:border-ink/25"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
        {tipoBase === "__outra__" && (
          <div className="mt-3">
            <Campo
              id="tipo-outra"
              rotulo="Descreva a ação"
              value={tipoOutra}
              erro={erros.tipo}
              maxLength={80}
              onChange={(e) => setTipoOutra(e.target.value)}
              placeholder="Ex.: adesivagem de veículos"
            />
          </div>
        )}
        {erros.tipo && tipoBase !== "__outra__" && (
          <p role="alert" className="mt-1.5 text-xs text-alert">
            {erros.tipo}
          </p>
        )}
      </section>

      {/* TOQUE 2 — quantidade */}
      <section className="mt-6">
        <label htmlFor="quantidade" className="text-small font-medium text-ink">
          2 · Quantidade
        </label>
        <div className="mt-2 flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => ajustarQuantidade(-10)}
            aria-label="Diminuir 10"
            className="w-14 shrink-0 rounded border border-line bg-surface/60 text-h2 text-ink active:scale-95"
          >
            −
          </button>
          <input
            id="quantidade"
            type="number"
            inputMode="numeric"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            className={`min-w-0 flex-1 border-b bg-transparent py-2 text-center font-mono text-2xl text-ink outline-none focus:border-seal ${
              erros.quantidade ? "border-alert" : "border-line"
            }`}
          />
          <button
            type="button"
            onClick={() => ajustarQuantidade(10)}
            aria-label="Aumentar 10"
            className="w-14 shrink-0 rounded border border-line bg-surface/60 text-h2 text-ink active:scale-95"
          >
            +
          </button>
        </div>
        <div className="mt-2 flex gap-2">
          {QUANTIAS_RAPIDAS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => ajustarQuantidade(q)}
              className="flex-1 rounded border border-line bg-surface/60 py-1.5 font-mono text-xs text-ink-muted active:scale-95"
            >
              +{q}
            </button>
          ))}
        </div>
        {erros.quantidade && (
          <p role="alert" className="mt-1.5 text-xs text-alert">
            {erros.quantidade}
          </p>
        )}
      </section>

      {/* Observação — opcional, fora dos 3 toques */}
      <section className="mt-6">
        {mostrarObs ? (
          <Campo.Area
            id="observacao"
            rotulo="Observação (opcional)"
            rows={2}
            maxLength={500}
            value={observacao}
            erro={erros.observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ponto de concentração, apoio, intercorrência…"
          />
        ) : (
          <button
            type="button"
            onClick={() => setMostrarObs(true)}
            className="text-small font-medium text-seal underline decoration-seal/40 underline-offset-4"
          >
            + observação
          </button>
        )}
      </section>

      {aviso && (
        <div className="mt-5">
          <Alerta
            tom={aviso.tom === "sucesso" ? "sucesso" : "critico"}
            titulo={aviso.tom === "sucesso" ? "Registrado" : "Não deu"}
          >
            {aviso.texto}
          </Alerta>
        </div>
      )}

      {/* TOQUE 3 — ação decisiva, fixa no rodapé (zona do polegar) */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-lg">
          <Selo
            voz="selo"
            onClick={enviar}
            disabled={!podeEnviar}
            carregando={pendente}
            textoCarregando="Registrando…"
            className="w-full py-3 text-base"
          >
            3 · Registrar atividade
          </Selo>
        </div>
      </div>

      {/* Histórico recente */}
      <section className="mt-10">
        <h2 className="text-h2 font-semibold text-ink">Últimos registros</h2>
        {registros.length === 0 ? (
          <div className="mt-3">
            <EstadoVazio
              titulo="Nenhuma atividade registrada ainda"
              descricao="O primeiro registro aparece aqui assim que você tocar em Registrar atividade."
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {registros.map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-3 py-3">
                <div className="min-w-0">
                  <span className="block font-medium text-ink">{r.tipo}</span>
                  <span className="block font-mono text-xs text-ink-muted">
                    {r.pessoaNome}
                    {r.regiaoNome ? ` · ${r.regiaoNome}` : ""} · {r.data}
                  </span>
                  {r.observacao && (
                    <span className="mt-0.5 block text-xs text-ink-muted">{r.observacao}</span>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span className="block font-mono text-base text-ink">{r.quantidade}</span>
                  <span
                    className={`font-mono text-[0.7rem] ${
                      r.sincronizadoEm ? "text-success" : "text-warning"
                    }`}
                  >
                    {r.sincronizadoEm ? "gravado" : "na fila"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
