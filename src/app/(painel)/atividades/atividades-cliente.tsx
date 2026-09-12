"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alerta } from "@/components/alerta";
import { Campo } from "@/components/campo";
import { Selo } from "@/components/selo";
import { EstadoVazio } from "@/components/estado-vazio";
import {
  contarFila,
  enfileirarAtividade,
  lerFilaAtividades,
  removerDaFila,
} from "@/lib/atividades/fila-offline";
import { sincronizarFila } from "@/lib/atividades/sincronizar-fila";
import type { EntradaRegistroAtividade } from "@/lib/atividades/registro-rapido";
import { registrarAtividade } from "./acoes";
import { rotuloCoordenada, useCoordenadaAtual } from "@/lib/atividades/use-coordenada";
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
const LS_TIPOS_PERSONALIZADOS = "atividade:tiposPersonalizados";

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
  const [tiposPersonalizados, setTiposPersonalizados] = useState<string[]>([]);
  const [adicionandoAcao, setAdicionandoAcao] = useState(false);
  const [nomeNovaAcao, setNomeNovaAcao] = useState("");
  const [erroNovaAcao, setErroNovaAcao] = useState<string | null>(null);

  const [quantidade, setQuantidade] = useState(100);
  const [observacao, setObservacao] = useState("");
  const [mostrarObs, setMostrarObs] = useState(false);
  const [trocarPessoa, setTrocarPessoa] = useState(false);

  const [erros, setErros] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{
    tom: "sucesso" | "critico" | "atencao";
    texto: string;
  } | null>(null);
  // Coordenada da atividade (migration 0038). Pedida ao abrir a tela, nunca no
  // envio: o registro rápido não pode esperar o GPS.
  const coordenada = useCoordenadaAtual();
  const [pendentes, setPendentes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);

  /** Envia um registro pela Server Action, traduzindo o resultado para a fila. */
  const enviarPelaRede = useCallback(async (entrada: EntradaRegistroAtividade) => {
    const r = await registrarAtividade(entrada);
    return {
      ok: r.status === "sucesso",
      // Erro de validação (tem `erros`) não adianta reenviar; erro genérico é transitório.
      descartavel: r.status === "erro" && Boolean(r.erros),
    };
  }, []);

  const sincronizar = useCallback(async () => {
    if (sincronizando) return;
    setSincronizando(true);
    try {
      const resultado = await sincronizarFila({
        lerFila: lerFilaAtividades,
        enviar: enviarPelaRede,
        remover: removerDaFila,
      });
      const restam = await contarFila();
      setPendentes(restam);
      if (resultado.enviados > 0) {
        setAviso({
          tom: "sucesso",
          texto: `${resultado.enviados} registro(s) da fila subiram.`,
        });
        router.refresh();
      }
      if (resultado.descartados > 0) {
        setAviso({
          tom: "atencao",
          texto: `${resultado.descartados} registro(s) da fila foram recusados e removidos.`,
        });
      }
    } finally {
      setSincronizando(false);
    }
  }, [enviarPelaRede, router, sincronizando]);

  // Ao montar: conta a fila e, se houver rede, tenta subir o que ficou pendente.
  useEffect(() => {
    contarFila()
      .then((n) => {
        setPendentes(n);
        if (n > 0 && navigator.onLine) void sincronizar();
      })
      .catch(() => {});
    // `sincronizar` é estável o bastante; rodar só na montagem é o desejado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sobe a fila sozinha quando o sinal volta.
  useEffect(() => {
    function aoVoltarRede() {
      void sincronizar();
    }
    window.addEventListener("online", aoVoltarRede);
    return () => window.removeEventListener("online", aoVoltarRede);
  }, [sincronizar]);

  // Recupera a última pessoa/tipo e carrega ações personalizadas salvas.
  useEffect(() => {
    const salvosRaw = lerLocal(LS_TIPOS_PERSONALIZADOS);
    let salvos: string[] = [];
    if (salvosRaw) {
      try {
        const parsed = JSON.parse(salvosRaw);
        if (Array.isArray(parsed)) {
          salvos = parsed.filter(
            (item): item is string => typeof item === "string" && item.trim().length > 0,
          );
        }
      } catch {
        // Formato anterior corrompido, ignora
      }
    }

    // Carrega também ações presentes nos registros recentes deste comitê
    const tiposHistorico = registros
      .map((r) => r.tipo?.trim())
      .filter(
        (t): t is string =>
          Boolean(t) && !(TIPOS_ACAO as readonly string[]).includes(t as (typeof TIPOS_ACAO)[number]),
      );

    const combinados = Array.from(new Set([...salvos, ...tiposHistorico]));
    setTiposPersonalizados(combinados);

    const ultimaPessoa = lerLocal(LS_PESSOA);
    if (ultimaPessoa && pessoas.some((p) => p.id === ultimaPessoa)) {
      setPessoaId(ultimaPessoa);
    } else {
      setTrocarPessoa(true);
    }

    const ultimoTipo = lerLocal(LS_TIPO);
    if (ultimoTipo) {
      if (
        (TIPOS_ACAO as readonly string[]).includes(ultimoTipo) ||
        combinados.includes(ultimoTipo)
      ) {
        setTipoBase(ultimoTipo);
      } else {
        setTipoBase("__outra__");
        setTipoOutra(ultimoTipo);
      }
    }
  }, [pessoas, registros]);

  const todasAsAcoes = useMemo(() => {
    return [...TIPOS_ACAO, ...tiposPersonalizados, "Outra"];
  }, [tiposPersonalizados]);

  function salvarNovaAcao() {
    const nomeLimpo = nomeNovaAcao.trim();
    if (!nomeLimpo) {
      setErroNovaAcao("Digite o nome da ação.");
      return;
    }
    if (nomeLimpo.length > 80) {
      setErroNovaAcao("O nome deve ter no máximo 80 caracteres.");
      return;
    }
    if (
      (TIPOS_ACAO as readonly string[]).some(
        (a) => a.toLowerCase() === nomeLimpo.toLowerCase(),
      ) ||
      tiposPersonalizados.some((a) => a.toLowerCase() === nomeLimpo.toLowerCase())
    ) {
      setErroNovaAcao("Esta ação já existe na lista.");
      return;
    }

    const atualizados = [...tiposPersonalizados, nomeLimpo];
    setTiposPersonalizados(atualizados);
    gravarLocal(LS_TIPOS_PERSONALIZADOS, JSON.stringify(atualizados));
    setTipoBase(nomeLimpo);
    setTipoOutra("");
    setNomeNovaAcao("");
    setAdicionandoAcao(false);
    setErroNovaAcao(null);
  }

  function removerAcaoPersonalizada(acao: string) {
    const atualizados = tiposPersonalizados.filter((t) => t !== acao);
    setTiposPersonalizados(atualizados);
    gravarLocal(LS_TIPOS_PERSONALIZADOS, JSON.stringify(atualizados));
    if (tipoBase === acao) {
      setTipoBase("");
    }
  }

  function salvarComoAtalho(nome: string) {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) return;
    if (
      (TIPOS_ACAO as readonly string[]).some(
        (a) => a.toLowerCase() === nomeLimpo.toLowerCase(),
      ) ||
      tiposPersonalizados.some((a) => a.toLowerCase() === nomeLimpo.toLowerCase())
    ) {
      setTipoBase(nomeLimpo);
      setTipoOutra("");
      return;
    }
    const atualizados = [...tiposPersonalizados, nomeLimpo];
    setTiposPersonalizados(atualizados);
    gravarLocal(LS_TIPOS_PERSONALIZADOS, JSON.stringify(atualizados));
    setTipoBase(nomeLimpo);
    setTipoOutra("");
  }

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

  function limparAposGravar() {
    gravarLocal(LS_PESSOA, pessoaId);
    if (tipo) gravarLocal(LS_TIPO, tipo);
    setObservacao("");
    setMostrarObs(false);
  }

  function enviar() {
    setAviso(null);
    setErros({});
    const entrada: EntradaRegistroAtividade = {
      pessoaId,
      regiaoId: pessoa?.regiaoId ?? undefined,
      tipo,
      quantidade,
      observacao,
      data: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()),
      // Vai junto para a fila offline também: o registro guardado sem sinal sobe
      // depois com a coordenada do momento em que foi feito, não do envio.
      latitude: coordenada.latitude,
      longitude: coordenada.longitude,
      precisaoM: coordenada.precisaoM,
    };

    iniciarEnvio(async () => {
      // Sem sinal: vai direto para a fila local, sem tentar a rede.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enfileirarAtividade(entrada);
        setPendentes(await contarFila());
        limparAposGravar();
        setAviso({
          tom: "atencao",
          texto: `Sem sinal. ${tipo} de ${pessoa?.nome ?? "—"} entrou na fila e sobe sozinha quando a rede voltar.`,
        });
        return;
      }

      let resultado;
      try {
        resultado = await registrarAtividade(entrada);
      } catch {
        // A chamada de rede falhou (offline intermitente) — guarda na fila.
        await enfileirarAtividade(entrada);
        setPendentes(await contarFila());
        limparAposGravar();
        setAviso({
          tom: "atencao",
          texto: "Falha de rede. O registro entrou na fila e sobe sozinho quando a conexão voltar.",
        });
        return;
      }

      if (resultado.status === "sucesso") {
        limparAposGravar();
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
        <div className="flex items-center justify-between">
          <span className="text-small font-medium text-ink">1 · Tipo de ação</span>
          {!adicionandoAcao && (
            <button
              type="button"
              onClick={() => {
                setAdicionandoAcao(true);
                setErroNovaAcao(null);
              }}
              className="text-xs font-medium text-seal hover:underline decoration-seal/40 underline-offset-4 flex items-center gap-1"
            >
              + Adicionar ação
            </button>
          )}
        </div>

        {/* Adicionar nova ação manualmente */}
        {adicionandoAcao && (
          <div className="mt-2.5 rounded-lg border border-line bg-surface/90 p-3.5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="nova-acao-nome" className="text-xs font-semibold text-ink">
                Nova ação personalizada
              </label>
              <button
                type="button"
                onClick={() => {
                  setAdicionandoAcao(false);
                  setErroNovaAcao(null);
                  setNomeNovaAcao("");
                }}
                className="text-xs text-ink-muted hover:text-ink transition-colors"
              >
                Cancelar
              </button>
            </div>
            <div className="flex gap-2">
              <input
                id="nova-acao-nome"
                type="text"
                value={nomeNovaAcao}
                onChange={(e) => {
                  setNomeNovaAcao(e.target.value);
                  setErroNovaAcao(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    salvarNovaAcao();
                  } else if (e.key === "Escape") {
                    setAdicionandoAcao(false);
                  }
                }}
                placeholder="Ex.: Carreata, Adesivaço, Comício…"
                maxLength={80}
                className="min-w-0 flex-1 rounded border border-line bg-surface px-3 py-2 text-small text-ink placeholder:text-ink-muted/50 outline-none focus:border-seal focus:ring-1 focus:ring-seal"
                autoFocus
              />
              <button
                type="button"
                onClick={salvarNovaAcao}
                disabled={!nomeNovaAcao.trim()}
                className="rounded bg-seal px-3.5 py-2 text-xs font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                Salvar ação
              </button>
            </div>
            {erroNovaAcao ? (
              <p role="alert" className="text-xs text-alert font-medium">
                {erroNovaAcao}
              </p>
            ) : (
              <p className="text-[0.7rem] text-ink-muted">
                A ação ficará salva como botão para registros rápidos futuros.
              </p>
            )}
          </div>
        )}

        <div className="mt-2 grid grid-cols-2 gap-2">
          {todasAsAcoes.map((t) => {
            const valor = t === "Outra" ? "__outra__" : t;
            const ativo = tipoBase === valor;
            const isPersonalizada = tiposPersonalizados.includes(t);

            return (
              <div key={t} className="relative group">
                <button
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setTipoBase(valor)}
                  className={`w-full min-h-14 rounded border px-3 py-2 text-left text-small transition-colors flex items-center justify-between ${
                    ativo
                      ? "border-seal bg-seal/15 font-semibold text-ink"
                      : "border-line bg-surface/60 text-ink-muted hover:border-ink/25"
                  } ${isPersonalizada ? "pr-8" : ""}`}
                >
                  <span className="line-clamp-2">{t}</span>
                </button>
                {isPersonalizada && (
                  <button
                    type="button"
                    aria-label={`Remover ação ${t}`}
                    title="Remover este botão"
                    onClick={(e) => {
                      e.stopPropagation();
                      removerAcaoPersonalizada(t);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-muted/50 hover:text-alert transition-colors rounded hover:bg-surface"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {tipoBase === "__outra__" && (
          <div className="mt-3 space-y-2">
            <Campo
              id="tipo-outra"
              rotulo="Descreva a ação"
              value={tipoOutra}
              erro={erros.tipo}
              maxLength={80}
              onChange={(e) => setTipoOutra(e.target.value)}
              placeholder="Ex.: adesivagem de veículos"
            />
            {tipoOutra.trim().length >= 3 &&
              !todasAsAcoes.some((a) => a.toLowerCase() === tipoOutra.trim().toLowerCase()) && (
                <button
                  type="button"
                  onClick={() => salvarComoAtalho(tipoOutra.trim())}
                  className="text-xs text-seal hover:underline decoration-seal/40 underline-offset-4 flex items-center gap-1 font-medium"
                >
                  + Salvar &quot;{tipoOutra.trim()}&quot; como botão para os próximos registros
                </button>
              )}
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

      {/* Status da coordenada. Fica visível sempre, inclusive quando não há
          local: o coordenador precisa saber que aquele registro vai sem prova
          de onde aconteceu, antes de gravar — não depois. */}
      <div className="mt-4 flex items-center gap-2 text-[0.7rem] font-mono text-ink-muted">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            coordenada.status === "capturada"
              ? "bg-success"
              : coordenada.status === "pendente"
                ? "bg-warning animate-pulse"
                : "bg-ink-subtle"
          }`}
        />
        <span>{rotuloCoordenada(coordenada.status)}</span>
        {coordenada.status === "capturada" && coordenada.precisaoM !== null && (
          <span className="text-ink-subtle">± {Math.round(coordenada.precisaoM)} m</span>
        )}
      </div>

      {pendentes > 0 && (
        <div className="mt-5">
          <Alerta
            tom="atencao"
            titulo={`${pendentes} registro(s) na fila`}
            acao={
              <button
                type="button"
                onClick={() => void sincronizar()}
                disabled={sincronizando}
                className="text-small font-medium text-seal underline decoration-seal/40 underline-offset-4 disabled:opacity-50"
              >
                {sincronizando ? "Enviando…" : "Tentar agora"}
              </button>
            }
          >
            Ainda não subiram. Sobem sozinhos quando a rede voltar — nada se perde.
          </Alerta>
        </div>
      )}

      {aviso && (
        <div className="mt-5">
          <Alerta
            tom={aviso.tom}
            titulo={
              aviso.tom === "sucesso" ? "Registrado" : aviso.tom === "atencao" ? "Na fila" : "Não deu"
            }
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
                  {r.latitude !== null && r.longitude !== null && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=17/${r.latitude}/${r.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-block font-mono text-[0.7rem] text-primary hover:underline"
                    >
                      ◎ {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                      {r.precisaoM !== null ? ` ± ${Math.round(r.precisaoM)} m` : ""}
                    </a>
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
