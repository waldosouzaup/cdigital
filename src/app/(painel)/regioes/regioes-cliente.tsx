"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alerta } from "@/components/alerta";
import { Campo } from "@/components/campo";
import { Selo } from "@/components/selo";
import { EstadoVazio } from "@/components/estado-vazio";
import { criarRegiao, renomearRegiao } from "./acoes";
import { ESTADO_INICIAL_REGIAO } from "./estado";
import type { RegiaoListada } from "./dados";

export function RegioesCliente({ regioesIniciais }: { regioesIniciais: RegiaoListada[] }) {
  const router = useRouter();

  const [estadoCriar, criarAction, criando] = useActionState(criarRegiao, ESTADO_INICIAL_REGIAO);
  const [estadoRenomear, renomearAction, renomeando] = useActionState(
    renomearRegiao,
    ESTADO_INICIAL_REGIAO,
  );
  const criarRef = useRef<HTMLFormElement>(null);
  const [editando, setEditando] = useState<string | null>(null);

  useEffect(() => {
    if (estadoCriar.status === "sucesso") {
      criarRef.current?.reset();
      router.refresh();
    }
  }, [estadoCriar.status, router]);

  useEffect(() => {
    if (estadoRenomear.status === "sucesso") {
      setEditando(null);
      router.refresh();
    }
  }, [estadoRenomear.status, router]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="regua border-b border-line pb-4">
        <h1 className="text-h1 font-semibold text-ink">Regiões de Atuação</h1>
        <p className="mt-1 text-small text-ink-muted">
          As regiões organizam pessoas, contratos e atividades por localidade. Só o gestor cadastra
          ou renomeia. Não há exclusão — regiões com pessoas ou contratos vinculados precisam ser
          mantidas para a integridade dos registros.
        </p>
        <Link
          href="/pessoas"
          className="mt-2 inline-block text-small font-medium text-seal underline decoration-seal/40 underline-offset-4"
        >
          ← Voltar para o quadro de pessoas
        </Link>
      </header>

      {/* Cadastrar */}
      <section className="border border-line bg-surface p-5">
        <h2 className="text-h2 font-semibold text-ink">Nova região</h2>
        <form ref={criarRef} action={criarAction} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Campo
              id="nova-regiao"
              name="nome"
              rotulo="Nome da região"
              required
              maxLength={60}
              placeholder="Ex.: Ceilândia"
              erro={estadoCriar.status === "erro" ? estadoCriar.erro : undefined}
            />
          </div>
          <Selo voz="selo" type="submit" carregando={criando} textoCarregando="Criando…" className="text-xs">
            Adicionar região
          </Selo>
        </form>
        {estadoCriar.status === "erro" && estadoCriar.mensagem && (
          <div className="mt-3">
            <Alerta tom="critico">{estadoCriar.mensagem}</Alerta>
          </div>
        )}
        {estadoCriar.status === "sucesso" && (
          <p className="mt-2 text-xs text-success">{estadoCriar.mensagem}</p>
        )}
      </section>

      {/* Lista */}
      <section>
        <h2 className="text-h2 font-semibold text-ink">
          Regiões cadastradas · {regioesIniciais.length}
        </h2>
        {regioesIniciais.length === 0 ? (
          <div className="mt-3">
            <EstadoVazio
              titulo="Nenhuma região cadastrada"
              descricao="Adicione a primeira região no formulário acima."
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {regioesIniciais.map((r) => (
              <li key={r.id} className="py-3">
                {editando === r.id ? (
                  <form
                    action={renomearAction}
                    className="flex flex-col gap-2 sm:flex-row sm:items-end"
                  >
                    <input type="hidden" name="id" value={r.id} />
                    <div className="flex-1">
                      <Campo
                        id={`renomear-${r.id}`}
                        name="nome"
                        rotulo="Novo nome"
                        required
                        maxLength={60}
                        defaultValue={r.nome}
                        erro={estadoRenomear.status === "erro" ? estadoRenomear.erro : undefined}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Selo voz="selo" type="submit" carregando={renomeando} className="text-xs">
                        Salvar
                      </Selo>
                      <Selo voz="linha" onClick={() => setEditando(null)} className="text-xs">
                        Cancelar
                      </Selo>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="block font-medium text-ink">{r.nome}</span>
                      <span className="block font-mono text-xs text-ink-muted">
                        {r.pessoas} pessoa(s)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditando(r.id)}
                      className="text-small font-medium text-seal underline decoration-seal/40 underline-offset-4"
                    >
                      Renomear
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {estadoRenomear.status === "erro" && estadoRenomear.mensagem && (
          <div className="mt-3">
            <Alerta tom="critico">{estadoRenomear.mensagem}</Alerta>
          </div>
        )}
      </section>
    </div>
  );
}
