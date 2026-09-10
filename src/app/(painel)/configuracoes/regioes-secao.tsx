"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alerta } from "@/components/alerta";
import { Badge } from "@/components/badge";
import { Campo } from "@/components/campo";
import { EstadoVazio } from "@/components/estado-vazio";
import { Modal } from "@/components/modal";
import { Selo } from "@/components/selo";
import {
  alternarAtivaFuncaoPretendida,
  criarFuncaoPretendida,
  criarRegiao,
  editarFuncaoPretendida,
  excluirFuncaoPretendida,
  excluirRegiao,
  renomearRegiao,
  restaurarFuncoesPadrao,
} from "../regioes/acoes";
import {
  ESTADO_INICIAL_FUNCAO,
  ESTADO_INICIAL_REGIAO,
} from "../regioes/estado";
import type { FuncaoPretendidaListada, RegiaoListada } from "../regioes/dados";

export function RegioesSecao({
  regioesIniciais,
  funcoesIniciais = [],
}: {
  regioesIniciais: RegiaoListada[];
  funcoesIniciais?: FuncaoPretendidaListada[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // -------------------------------------------------------------
  // Estados de Regiões
  // -------------------------------------------------------------
  const [estadoCriarRegiao, criarRegiaoAction, criandoRegiao] = useActionState(
    criarRegiao,
    ESTADO_INICIAL_REGIAO,
  );
  const [estadoRenomearRegiao, renomearRegiaoAction, renomeandoRegiao] = useActionState(
    renomearRegiao,
    ESTADO_INICIAL_REGIAO,
  );
  const criarRegiaoRef = useRef<HTMLFormElement>(null);
  const [editandoRegiaoId, setEditandoRegiaoId] = useState<string | null>(null);

  // Modal de Exclusão de Região
  const [regiaoParaExcluir, setRegiaoParaExcluir] = useState<RegiaoListada | null>(null);
  const [motivoExclusaoRegiao, setMotivoExclusaoRegiao] = useState("");
  const [excluindoRegiao, setExcluindoRegiao] = useState(false);
  const [erroExcluirRegiao, setErroExcluirRegiao] = useState<string | null>(null);

  // -------------------------------------------------------------
  // Estados de Funções Pretendidas
  // -------------------------------------------------------------
  const [estadoCriarFuncao, criarFuncaoAction, criandoFuncao] = useActionState(
    criarFuncaoPretendida,
    ESTADO_INICIAL_FUNCAO,
  );
  const [estadoEditarFuncao, editarFuncaoAction, editandoFuncao] = useActionState(
    editarFuncaoPretendida,
    ESTADO_INICIAL_FUNCAO,
  );

  const [modalNovaFuncaoAberto, setModalNovaFuncaoAberto] = useState(false);
  const [funcaoParaEditar, setFuncaoParaEditar] = useState<FuncaoPretendidaListada | null>(null);
  const [funcaoParaExcluir, setFuncaoParaExcluir] = useState<FuncaoPretendidaListada | null>(null);
  const [motivoExclusaoFuncao, setMotivoExclusaoFuncao] = useState("");
  const [excluindoFuncao, setExcluindoFuncao] = useState(false);
  const [erroExcluirFuncao, setErroExcluirFuncao] = useState<string | null>(null);
  const [mensagemSucessoFuncao, setMensagemSucessoFuncao] = useState<string | null>(null);

  const formNovaFuncaoRef = useRef<HTMLFormElement>(null);
  const formEditarFuncaoRef = useRef<HTMLFormElement>(null);

  // Sincronização e limpezas
  useEffect(() => {
    if (estadoCriarRegiao.status === "sucesso") {
      criarRegiaoRef.current?.reset();
      router.refresh();
    }
  }, [estadoCriarRegiao.status, router]);

  useEffect(() => {
    if (estadoRenomearRegiao.status === "sucesso") {
      setEditandoRegiaoId(null);
      router.refresh();
    }
  }, [estadoRenomearRegiao.status, router]);

  useEffect(() => {
    if (estadoCriarFuncao.status === "sucesso") {
      setModalNovaFuncaoAberto(false);
      formNovaFuncaoRef.current?.reset();
      setMensagemSucessoFuncao(estadoCriarFuncao.mensagem ?? "Função cadastrada.");
      router.refresh();
    }
  }, [estadoCriarFuncao, router]);

  useEffect(() => {
    if (estadoEditarFuncao.status === "sucesso") {
      setFuncaoParaEditar(null);
      setMensagemSucessoFuncao(estadoEditarFuncao.mensagem ?? "Função atualizada.");
      router.refresh();
    }
  }, [estadoEditarFuncao, router]);

  // Handlers de Ações
  async function handleConfirmarExclusaoRegiao() {
    if (!regiaoParaExcluir) return;
    setExcluindoRegiao(true);
    setErroExcluirRegiao(null);

    const res = await excluirRegiao(regiaoParaExcluir.id, motivoExclusaoRegiao);
    setExcluindoRegiao(false);

    if (!res.ok) {
      setErroExcluirRegiao(res.mensagem);
      return;
    }

    setRegiaoParaExcluir(null);
    setMotivoExclusaoRegiao("");
    router.refresh();
  }

  async function handleAlternarAtivaFuncao(funcao: FuncaoPretendidaListada) {
    startTransition(async () => {
      const res = await alternarAtivaFuncaoPretendida(funcao.id, !funcao.ativa);
      if (res.ok) {
        setMensagemSucessoFuncao(res.mensagem ?? null);
        router.refresh();
      }
    });
  }

  async function handleConfirmarExclusaoFuncao() {
    if (!funcaoParaExcluir) return;
    setExcluindoFuncao(true);
    setErroExcluirFuncao(null);

    const res = await excluirFuncaoPretendida(funcaoParaExcluir.id, motivoExclusaoFuncao);
    setExcluindoFuncao(false);

    if (!res.ok) {
      setErroExcluirFuncao(res.erro ?? "Não foi possível excluir a função pretendida.");
      return;
    }

    setFuncaoParaExcluir(null);
    setMotivoExclusaoFuncao("");
    setMensagemSucessoFuncao(res.mensagem ?? null);
    router.refresh();
  }

  async function handleRestaurarPadroes() {
    startTransition(async () => {
      const res = await restaurarFuncoesPadrao();
      if (res.ok) {
        setMensagemSucessoFuncao(res.mensagem ?? null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-10">
      {/* Informações de Governança Territorial & Inscrição */}
      <div className="border-l-2 border-primary bg-primary/5 p-4 text-xs text-ink-muted leading-relaxed space-y-1 rounded-r-md">
        <p className="font-semibold text-ink">Governança Territorial e Funções de Inscrição</p>
        <p>
          Configure os dados territoriais e o catálogo de funções disponíveis para o público na página de
          autoinscrição. As alterações são refletidas instantaneamente nos formulários públicos e na
          gestão de equipes e contratos.
        </p>
        <div className="pt-1 flex flex-wrap gap-4">
          <Link
            href="/pessoas"
            className="text-primary hover:underline font-medium inline-flex items-center gap-1"
          >
            ← Ver distribuição no quadro de colaboradores
          </Link>
          <Link
            href="/inscricao/padrao"
            target="_blank"
            className="text-primary hover:underline font-medium inline-flex items-center gap-1"
          >
            ↗ Pré-visualizar formulário de inscrição
          </Link>
        </div>
      </div>

      {mensagemSucessoFuncao && (
        <Alerta tom="sucesso">{mensagemSucessoFuncao}</Alerta>
      )}

      {/* =====================================================================
          SEÇÃO 1: REGIÕES DE ATUAÇÃO
          ===================================================================== */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line pb-3">
          <div>
            <h2 className="text-h2 font-semibold text-ink">Regiões de Atuação Territorial</h2>
            <p className="text-xs text-ink-muted">
              Organizam pessoas, contratos e atividades de rua por localidade e comitê.
            </p>
          </div>
          <span className="font-mono text-xs text-ink-muted bg-surface-sunken px-2.5 py-1 rounded border border-line shrink-0 w-fit">
            {regioesIniciais.length} região(ões)
          </span>
        </div>

        {/* Formulário: Nova Região */}
        <div className="border border-line bg-surface p-5 rounded-md shadow-xs">
          <h3 className="text-small font-semibold text-ink">Adicionar nova região</h3>
          <form
            ref={criarRegiaoRef}
            action={criarRegiaoAction}
            className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <Campo
                id="nova-regiao"
                name="nome"
                rotulo="Nome da região"
                required
                maxLength={60}
                placeholder="Ex.: Ceilândia, Plano Piloto, Taguatinga, Zona Sul…"
                erro={estadoCriarRegiao.status === "erro" ? estadoCriarRegiao.erro : undefined}
              />
            </div>
            <Selo
              voz="selo"
              type="submit"
              carregando={criandoRegiao}
              textoCarregando="Criando…"
              className="text-xs shrink-0 py-2.5"
            >
              Adicionar região
            </Selo>
          </form>
          {estadoCriarRegiao.status === "erro" && estadoCriarRegiao.mensagem && (
            <div className="mt-3">
              <Alerta tom="critico">{estadoCriarRegiao.mensagem}</Alerta>
            </div>
          )}
          {estadoCriarRegiao.status === "sucesso" && (
            <p className="mt-2 text-xs text-success font-medium">{estadoCriarRegiao.mensagem}</p>
          )}
        </div>

        {/* Lista de Regiões */}
        {regioesIniciais.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma região cadastrada"
            descricao="Adicione a primeira região no formulário acima para organizar as equipes de campo."
          />
        ) : (
          <div className="border border-line bg-surface rounded-md overflow-hidden">
            <ul className="divide-y divide-line">
              {regioesIniciais.map((r) => (
                <li key={r.id} className="p-4 transition-colors hover:bg-surface-sunken/40">
                  {editandoRegiaoId === r.id ? (
                    <form
                      action={renomearRegiaoAction}
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
                          erro={estadoRenomearRegiao.status === "erro" ? estadoRenomearRegiao.erro : undefined}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Selo voz="selo" type="submit" carregando={renomeandoRegiao} className="text-xs">
                          Salvar
                        </Selo>
                        <Selo voz="linha" onClick={() => setEditandoRegiaoId(null)} className="text-xs">
                          Cancelar
                        </Selo>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink text-small">{r.nome}</span>
                          <span className="text-xs font-mono text-ink-muted bg-surface-sunken px-2 py-0.5 rounded border border-line">
                            {r.pessoas} pessoa(s) vinculada(s)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditandoRegiaoId(r.id)}
                          className="text-xs font-medium text-primary hover:underline cursor-pointer"
                        >
                          Renomear
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRegiaoParaExcluir(r);
                            setErroExcluirRegiao(null);
                            setMotivoExclusaoRegiao("");
                          }}
                          className="text-xs font-medium text-danger hover:underline cursor-pointer"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {estadoRenomearRegiao.status === "erro" && estadoRenomearRegiao.mensagem && (
          <Alerta tom="critico">{estadoRenomearRegiao.mensagem}</Alerta>
        )}
      </section>

      {/* =====================================================================
          SEÇÃO 2: FUNÇÕES PRETENDIDAS (FORMULÁRIO DE INSCRIÇÃO PÚBLICA)
          ===================================================================== */}
      <section className="space-y-4 pt-4 border-t border-line">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-h2 font-semibold text-ink">Funções Pretendidas (Atividades de Inscrição)</h2>
              <span className="font-mono text-xs text-ink-muted bg-surface-sunken px-2.5 py-1 rounded border border-line">
                {funcoesIniciais.length} função(ões)
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Lista de atividades apresentadas no formulário público de captura de dados. O gestor pode cadastrar,
              editar, ocultar temporariamente ou excluir com registro em auditoria.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRestaurarPadroes}
              disabled={isPending}
              className="text-xs text-ink-muted hover:text-ink border border-line hover:border-ink px-3 py-2 rounded bg-surface hover:bg-surface-sunken transition-colors cursor-pointer"
              title="Garante que as 4 funções básicas de campanha eleitoral estejam cadastradas"
            >
              Restaurar Padrões
            </button>
            <Selo
              voz="selo"
              type="button"
              onClick={() => setModalNovaFuncaoAberto(true)}
              className="text-xs py-2"
            >
              + Nova Função Pretendida
            </Selo>
          </div>
        </div>

        {funcoesIniciais.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-line rounded-lg space-y-3 bg-surface">
            <p className="text-small text-ink-muted">
              Nenhuma função pretendida cadastrada para esta campanha.
            </p>
            <div className="flex justify-center gap-3">
              <Selo voz="selo" onClick={() => setModalNovaFuncaoAberto(true)} className="text-xs">
                Cadastrar Função
              </Selo>
              <Selo voz="linha" onClick={handleRestaurarPadroes} className="text-xs">
                Carregar Padrões do Catálogo
              </Selo>
            </div>
          </div>
        ) : (
          <div className="border border-line bg-surface rounded-md overflow-hidden">
            <ul className="divide-y divide-line">
              {funcoesIniciais.map((f) => (
                <li
                  key={f.id}
                  className={`p-4 transition-colors hover:bg-surface-sunken/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                    !f.ativa ? "opacity-75 bg-surface-sunken/20" : ""
                  }`}
                >
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink text-small">{f.nome}</span>
                      {f.ativa ? (
                        <Badge status="aprovado">Ativa no formulário</Badge>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-sunken text-ink-muted border border-line">
                          Oculta do formulário
                        </span>
                      )}
                      <span className="text-xs font-mono text-ink-muted">
                        {f.pessoas} pessoa(s) inscrita(s)
                      </span>
                    </div>
                    {f.descricao ? (
                      <p className="text-xs text-ink-muted leading-relaxed">{f.descricao}</p>
                    ) : (
                      <p className="text-xs text-ink-muted/60 italic">Sem descrição detalhada</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleAlternarAtivaFuncao(f)}
                      disabled={isPending}
                      className="text-xs text-ink-muted hover:text-ink hover:underline cursor-pointer"
                    >
                      {f.ativa ? "Ocultar" : "Ativar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFuncaoParaEditar(f)}
                      className="text-xs text-primary font-medium hover:underline cursor-pointer"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFuncaoParaExcluir(f);
                        setErroExcluirFuncao(null);
                        setMotivoExclusaoFuncao("");
                      }}
                      className="text-xs text-danger hover:underline cursor-pointer"
                    >
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* =====================================================================
          MODAL: EXCLUIR REGIÃO (COM TRAVAS DE INTEGRIDADE)
          ===================================================================== */}
      <Modal
        aberto={Boolean(regiaoParaExcluir)}
        aoFechar={() => setRegiaoParaExcluir(null)}
        titulo={`Excluir Região: ${regiaoParaExcluir?.nome ?? ""}`}
        larguraMaxima="max-w-md"
        ocultarRodapePadrao
      >
        {regiaoParaExcluir && (
          <div className="space-y-4">
            {regiaoParaExcluir.pessoas > 0 ? (
              <div className="space-y-3">
                <Alerta tom="critico">
                  Esta região possui <strong>{regiaoParaExcluir.pessoas} pessoa(s) vinculada(s)</strong>.
                  Por integridade cadastral e prestação de contas, você deve realocar os colaboradores
                  para outra região na tela de Pessoas antes de excluir.
                </Alerta>
                <div className="pt-2 flex justify-end gap-2">
                  <Selo voz="linha" onClick={() => setRegiaoParaExcluir(null)} className="text-xs">
                    Fechar
                  </Selo>
                  <Link
                    href="/pessoas"
                    className="inline-flex items-center px-3 py-2 text-xs font-semibold rounded bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
                  >
                    Ir para Colaboradores
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-small text-ink-muted">
                  Tem certeza que deseja excluir a região <strong>{regiaoParaExcluir.nome}</strong>?
                  Esta ação não pode ser desfeita. Um snapshot será gravado na auditoria do sistema.
                </p>

                <Campo
                  id="motivo-exclusao-regiao"
                  rotulo="Motivo da exclusão (opcional para auditoria)"
                  value={motivoExclusaoRegiao}
                  onChange={(e) => setMotivoExclusaoRegiao(e.target.value)}
                  placeholder="Ex.: Comitê territorial unificado com região vizinha"
                />

                {erroExcluirRegiao && (
                  <Alerta tom="critico">{erroExcluirRegiao}</Alerta>
                )}

                <div className="pt-3 border-t border-line flex justify-end gap-2">
                  <Selo
                    voz="linha"
                    onClick={() => setRegiaoParaExcluir(null)}
                    disabled={excluindoRegiao}
                    className="text-xs"
                  >
                    Cancelar
                  </Selo>
                  <Selo
                    voz="perigo"
                    onClick={handleConfirmarExclusaoRegiao}
                    carregando={excluindoRegiao}
                    textoCarregando="Excluindo…"
                    className="text-xs"
                  >
                    Confirmar Exclusão
                  </Selo>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* =====================================================================
          MODAL: CADASTRAR NOVA FUNÇÃO PRETENDIDA
          ===================================================================== */}
      <Modal
        aberto={modalNovaFuncaoAberto}
        aoFechar={() => setModalNovaFuncaoAberto(false)}
        titulo="Nova Função Pretendida"
        descricao="Esta função ficará disponível para seleção de novos candidatos na página de inscrição pública."
        larguraMaxima="max-w-lg"
        ocultarRodapePadrao
      >
        <form ref={formNovaFuncaoRef} action={criarFuncaoAction} className="space-y-4">
          <Campo
            id="nova-funcao-nome"
            name="nome"
            rotulo="Nome da Função"
            required
            maxLength={80}
            placeholder="Ex.: Articulador Comunitário, Apoio Jurídico…"
            erro={estadoCriarFuncao.status === "erro" ? estadoCriarFuncao.erro : undefined}
          />

          <div>
            <label htmlFor="nova-funcao-desc" className="block text-small font-medium text-ink mb-1">
              Descrição das Atividades (opcional)
            </label>
            <textarea
              id="nova-funcao-desc"
              name="descricao"
              rows={3}
              maxLength={255}
              placeholder="Descreva brevemente o escopo de atuação ou requisitos esperados…"
              className="w-full border border-line bg-surface p-2.5 text-small text-ink rounded focus:border-primary focus:outline-none placeholder:text-ink-muted/60 resize-none"
            />
          </div>

          {estadoCriarFuncao.status === "erro" && estadoCriarFuncao.mensagem && (
            <Alerta tom="critico">{estadoCriarFuncao.mensagem}</Alerta>
          )}

          <div className="pt-4 border-t border-line flex justify-end gap-2">
            <Selo
              voz="linha"
              type="button"
              onClick={() => setModalNovaFuncaoAberto(false)}
              disabled={criandoFuncao}
              className="text-xs"
            >
              Cancelar
            </Selo>
            <Selo
              voz="selo"
              type="submit"
              carregando={criandoFuncao}
              textoCarregando="Salvando…"
              className="text-xs"
            >
              Salvar Função
            </Selo>
          </div>
        </form>
      </Modal>

      {/* =====================================================================
          MODAL: EDITAR FUNÇÃO PRETENDIDA
          ===================================================================== */}
      <Modal
        aberto={Boolean(funcaoParaEditar)}
        aoFechar={() => setFuncaoParaEditar(null)}
        titulo={`Editar Função: ${funcaoParaEditar?.nome ?? ""}`}
        descricao="Altere o nome e a descrição das atividades desta função pretendida."
        larguraMaxima="max-w-lg"
        ocultarRodapePadrao
      >
        {funcaoParaEditar && (
          <form ref={formEditarFuncaoRef} action={editarFuncaoAction} className="space-y-4">
            <input type="hidden" name="id" value={funcaoParaEditar.id} />
            <Campo
              id="editar-funcao-nome"
              name="nome"
              rotulo="Nome da Função"
              required
              maxLength={80}
              defaultValue={funcaoParaEditar.nome}
              erro={estadoEditarFuncao.status === "erro" ? estadoEditarFuncao.erro : undefined}
            />

            <div>
              <label htmlFor="editar-funcao-desc" className="block text-small font-medium text-ink mb-1">
                Descrição das Atividades (opcional)
              </label>
              <textarea
                id="editar-funcao-desc"
                name="descricao"
                rows={3}
                maxLength={255}
                defaultValue={funcaoParaEditar.descricao ?? ""}
                placeholder="Descreva brevemente o escopo de atuação ou requisitos esperados…"
                className="w-full border border-line bg-surface p-2.5 text-small text-ink rounded focus:border-primary focus:outline-none placeholder:text-ink-muted/60 resize-none"
              />
            </div>

            {estadoEditarFuncao.status === "erro" && estadoEditarFuncao.mensagem && (
              <Alerta tom="critico">{estadoEditarFuncao.mensagem}</Alerta>
            )}

            <div className="pt-4 border-t border-line flex justify-end gap-2">
              <Selo
                voz="linha"
                type="button"
                onClick={() => setFuncaoParaEditar(null)}
                disabled={editandoFuncao}
                className="text-xs"
              >
                Cancelar
              </Selo>
              <Selo
                voz="selo"
                type="submit"
                carregando={editandoFuncao}
                textoCarregando="Salvando…"
                className="text-xs"
              >
                Atualizar Função
              </Selo>
            </div>
          </form>
        )}
      </Modal>

      {/* =====================================================================
          MODAL: EXCLUIR FUNÇÃO PRETENDIDA
          ===================================================================== */}
      <Modal
        aberto={Boolean(funcaoParaExcluir)}
        aoFechar={() => setFuncaoParaExcluir(null)}
        titulo={`Excluir Função: ${funcaoParaExcluir?.nome ?? ""}`}
        larguraMaxima="max-w-md"
        ocultarRodapePadrao
      >
        {funcaoParaExcluir && (
          <div className="space-y-4">
            {funcaoParaExcluir.pessoas > 0 && (
              <Alerta tom="informativo">
                Existem <strong>{funcaoParaExcluir.pessoas} pessoa(s)</strong> cadastradas com esta função.
                Ao excluir, o histórico delas é preservado, mas a função deixará de existir no catálogo.
                <div className="mt-2 text-xs">
                  <strong>Dica:</strong> Se você deseja apenas que novos inscritos não selecionem mais esta função,
                  é recomendado clicar em <strong>Ocultar</strong> na listagem em vez de excluir.
                </div>
              </Alerta>
            )}

            <p className="text-small text-ink-muted">
              Deseja realmente remover a função <strong>{funcaoParaExcluir.nome}</strong>?
              Um registro de auditoria será arquivado em Dados Excluídos.
            </p>

            <Campo
              id="motivo-exclusao-funcao"
              rotulo="Motivo da exclusão (opcional)"
              value={motivoExclusaoFuncao}
              onChange={(e) => setMotivoExclusaoFuncao(e.target.value)}
              placeholder="Ex.: Função descontinuada na campanha"
            />

            {erroExcluirFuncao && (
              <Alerta tom="critico">{erroExcluirFuncao}</Alerta>
            )}

            <div className="pt-3 border-t border-line flex justify-end gap-2">
              <Selo
                voz="linha"
                onClick={() => setFuncaoParaExcluir(null)}
                disabled={excluindoFuncao}
                className="text-xs"
              >
                Cancelar
              </Selo>
              <Selo
                voz="perigo"
                onClick={handleConfirmarExclusaoFuncao}
                carregando={excluindoFuncao}
                textoCarregando="Excluindo…"
                className="text-xs"
              >
                Confirmar Exclusão
              </Selo>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
