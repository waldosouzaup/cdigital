"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Campo } from "@/components/campo";
import { Selo } from "@/components/selo";
import { Alerta } from "@/components/alerta";
import { EstadoVazio } from "@/components/estado-vazio";
import { capitalizar, termos, type Vertical } from "@/lib/organizacao/vertical";
import { criarEscala, excluirEscala, type EstadoEscala } from "./acoes";
import type { TurnoListado } from "./dados";
import type { PessoaOpcao, RegiaoOpcao } from "../atividades/dados";

function formatarFaixa(inicio: string, fim: string): string {
  const fmt = (iso: string, comData: boolean) =>
    new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      ...(comData ? { day: "2-digit", month: "2-digit" } : {}),
      hour: "2-digit",
      minute: "2-digit",
    });

  const mesmoDia =
    new Date(inicio).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) ===
    new Date(fim).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  // Turno que vira a noite mostra a data nas duas pontas, senão "22:00 às 04:00"
  // parece um turno que anda para trás.
  return `${fmt(inicio, true)} às ${fmt(fim, !mesmoDia)}`;
}

function diaDoTurno(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export function EscalasCliente({
  turnosIniciais,
  pessoas,
  regioes,
  vertical,
}: {
  turnosIniciais: TurnoListado[];
  pessoas: PessoaOpcao[];
  regioes: RegiaoOpcao[];
  vertical: Vertical;
}) {
  const router = useRouter();
  const t = termos(vertical);
  const [estado, setEstado] = useState<EstadoEscala>({ status: "idle" });
  const [pendente, iniciar] = useTransition();

  const [pessoaId, setPessoaId] = useState("");
  const [regiaoId, setRegiaoId] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [funcao, setFuncao] = useState("");
  const [local, setLocal] = useState("");

  // Agrupa por dia: uma escala se lê por jornada, não como lista corrida.
  const porDia = useMemo(() => {
    const mapa = new Map<string, TurnoListado[]>();
    for (const turno of turnosIniciais) {
      const dia = diaDoTurno(turno.inicio);
      mapa.set(dia, [...(mapa.get(dia) ?? []), turno]);
    }
    return [...mapa.entries()];
  }, [turnosIniciais]);

  function salvar() {
    iniciar(async () => {
      const r = await criarEscala({ pessoaId, regiaoId, inicio, fim, funcao, local });
      setEstado(r);
      if (r.status === "sucesso") {
        setInicio("");
        setFim("");
        setFuncao("");
        setLocal("");
        router.refresh();
      }
    });
  }

  function remover(id: string) {
    iniciar(async () => {
      const r = await excluirEscala(id);
      setEstado(r);
      if (r.status === "sucesso") router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <header className="regua">
        <h1 className="text-h1 font-semibold text-ink">Escala de Turnos</h1>
        <p className="mt-1 text-small text-ink-muted">
          Quem trabalha quando. O que já foi executado fica em {t.atividade}.
        </p>
      </header>

      {estado.status === "sucesso" && <Alerta tom="sucesso">{estado.mensagem}</Alerta>}
      {estado.status === "erro" && estado.mensagem && (
        <Alerta tom="critico">{estado.mensagem}</Alerta>
      )}

      <section className="rounded-lg border border-line bg-surface p-5 space-y-4">
        <h2 className="text-small font-semibold text-ink">Novo turno</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo.Selecao
            rotulo={capitalizar(t.colaborador)}
            id="escala-pessoa"
            value={pessoaId}
            onChange={(e) => setPessoaId(e.target.value)}
            erro={estado.status === "erro" ? estado.erros?.pessoaId : undefined}
          >
            <option value="">Selecione…</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Campo.Selecao>

          <Campo.Selecao
            rotulo={capitalizar(t.regiao)}
            id="escala-regiao"
            value={regiaoId}
            onChange={(e) => setRegiaoId(e.target.value)}
          >
            <option value="">Sem {t.regiao}</option>
            {regioes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </Campo.Selecao>

          <Campo
            rotulo="Início"
            id="escala-inicio"
            type="datetime-local"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            erro={estado.status === "erro" ? estado.erros?.inicio : undefined}
          />
          <Campo
            rotulo="Fim"
            id="escala-fim"
            type="datetime-local"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            auxiliar="Turno que vira a noite é normal — basta pôr a data do dia seguinte."
            erro={estado.status === "erro" ? estado.erros?.fim : undefined}
          />

          <Campo
            rotulo="Função no turno"
            id="escala-funcao"
            value={funcao}
            onChange={(e) => setFuncao(e.target.value)}
            placeholder="Portaria, montagem, panfletagem…"
          />
          <Campo
            rotulo="Local"
            id="escala-local"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Portão B, Loja Centro, Frente 2…"
          />
        </div>

        <div className="flex justify-end">
          <Selo
            voz="selo"
            onClick={salvar}
            carregando={pendente}
            textoCarregando="Salvando…"
            disabled={pendente || !pessoaId || !inicio || !fim}
          >
            Escalar
          </Selo>
        </div>
      </section>

      <section className="space-y-4">
        {porDia.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum turno na escala"
            descricao="Turnos futuros aparecem aqui, agrupados por dia. Crie o primeiro no formulário acima."
          />
        ) : (
          porDia.map(([dia, turnos]) => (
            <div key={dia} className="rounded-lg border border-line bg-surface overflow-hidden">
              <div className="border-b border-line bg-surface-sunken px-4 py-2">
                <span className="font-mono text-[0.7rem] uppercase tracking-wider text-ink-muted">
                  {dia}
                </span>
              </div>
              <ul className="divide-y divide-line">
                {turnos.map((turno) => (
                  <li key={turno.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <span className="block text-small font-medium text-ink">
                        {turno.pessoaNome}
                      </span>
                      <span className="block font-mono text-xs text-ink-muted">
                        {formatarFaixa(turno.inicio, turno.fim)}
                        {turno.funcao ? ` · ${turno.funcao}` : ""}
                        {turno.local ? ` · ${turno.local}` : ""}
                        {turno.regiaoNome ? ` · ${turno.regiaoNome}` : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => remover(turno.id)}
                      disabled={pendente}
                      className="shrink-0 text-xs text-ink-muted hover:text-danger hover:underline disabled:opacity-50"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
