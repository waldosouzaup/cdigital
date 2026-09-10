"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alerta } from "@/components/alerta";
import { Campo } from "@/components/campo";
import { Selo } from "@/components/selo";
import { EstadoVazio } from "@/components/estado-vazio";
import { criarRegiao, renomearRegiao } from "../regioes/acoes";
import { ESTADO_INICIAL_REGIAO } from "../regioes/estado";
import type { RegiaoListada } from "../regioes/dados";

export function RegioesSecao({ regioesIniciais }: { regioesIniciais: RegiaoListada[] }) {
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
    <div className="space-y-6">
      {/* Informações de Governança Territorial */}
      <div className="border-l-2 border-primary bg-primary/5 p-4 text-xs text-ink-muted leading-relaxed space-y-1">
        <p className="font-semibold text-ink">Governança Territorial das Regiões</p>
        <p>
          As regiões organizam pessoas, contratos e atividades por localidade. Só o gestor cadastra
          ou renomeia. Não há exclusão — regiões com pessoas ou contratos vinculados precisam ser
          mantidas para a integridade dos registros e auditoria da prestação de contas.
        </p>
        <div className="pt-1">
          <Link
            href="/pessoas"
            className="text-primary hover:underline font-medium inline-flex items-center gap-1"
          >
            ← Ver distribuição no quadro de colaboradores
          </Link>
        </div>
      </div>

      {/* Cadastrar Nova Região */}
      <section className="border border-line bg-surface p-5 rounded-md shadow-xs">
        <h2 className="text-small font-semibold text-ink">Nova região de atuação</h2>
        <form
          ref={criarRef}
          action={criarAction}
          className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <Campo
              id="nova-regiao"
              name="nome"
              rotulo="Nome da região"
              required
              maxLength={60}
              placeholder="Ex.: Ceilândia, Plano Piloto, Taguatinga…"
              erro={estadoCriar.status === "erro" ? estadoCriar.erro : undefined}
            />
          </div>
          <Selo
            voz="selo"
            type="submit"
            carregando={criando}
            textoCarregando="Criando…"
            className="text-xs shrink-0 py-2.5"
          >
            Adicionar região
          </Selo>
        </form>
        {estadoCriar.status === "erro" && estadoCriar.mensagem && (
          <div className="mt-3">
            <Alerta tom="critico">{estadoCriar.mensagem}</Alerta>
          </div>
        )}
        {estadoCriar.status === "sucesso" && (
          <p className="mt-2 text-xs text-success font-medium">{estadoCriar.mensagem}</p>
        )}
      </section>

      {/* Lista de Regiões */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-small font-semibold text-ink">
            Regiões cadastradas
          </h2>
          <span className="font-mono text-xs text-ink-muted bg-surface-sunken px-2 py-0.5 rounded border border-line">
            {regioesIniciais.length} região(ões)
          </span>
        </div>

        {regioesIniciais.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma região cadastrada"
            descricao="Adicione a primeira região no formulário acima para organizar as equipes de campo."
          />
        ) : (
          <ul className="divide-y divide-line border border-line bg-surface rounded-md overflow-hidden">
            {regioesIniciais.map((r) => (
              <li key={r.id} className="p-4 transition-colors hover:bg-surface-sunken/40">
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
                        rotulo="Novo nome da região"
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
                      <span className="block font-medium text-ink text-small">{r.nome}</span>
                      <span className="block font-mono text-xs text-ink-muted">
                        {r.pessoas} pessoa(s) vinculada(s)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditando(r.id)}
                      className="text-xs font-medium text-seal hover:underline decoration-seal/40 underline-offset-4 cursor-pointer"
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
