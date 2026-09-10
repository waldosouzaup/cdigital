"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Campo } from "@/components/campo";
import { Selo } from "@/components/selo";
import { Badge, type StatusTipo } from "@/components/badge";
import { Modal } from "@/components/modal";
import { OcrDocumento } from "@/components/ocr-documento";
import { EstadoVazio } from "@/components/estado-vazio";
import { Alerta } from "@/components/alerta";
import { Paginacao } from "@/components/paginacao";
import { RelatorioIdadeSecao } from "./relatorio-idade-secao";
import { criarPessoa, gerarLinkColeta } from "./acoes";
import { ESTADO_INICIAL_CRIAR_PESSOA } from "./estado";
import type { PessoaListada, RegiaoOpcao } from "./dados";

const FUNCOES_CONHECIDAS = [
  "Militância e Mobilização de Rua",
  "Administrativo e Montagem de Material",
  "Administrativo Homeoffice",
  "Coordenador de Comitê da Campanha",
];

// Valores que a coluna `status_contrato` do banco pode assumir (Seção 7) — usados só
// para saber se dá pra confiar o texto vindo do banco direto ao componente de Badge
// sem passar por um `as any`.
const STATUS_CONHECIDOS: StatusTipo[] = [
  "rascunho",
  "emitido",
  "enviado",
  "assinado",
  "distratado",
  "distrato_assinado",
  "encerrado",
  "cancelado",
];

function statusContratoParaBadge(status: string | null): StatusTipo | null {
  if (!status) return null;
  return (STATUS_CONHECIDOS as string[]).includes(status) ? (status as StatusTipo) : null;
}

export function PessoasCliente({
  pessoasIniciais,
  regioes,
}: {
  pessoasIniciais: PessoaListada[];
  regioes: RegiaoOpcao[];
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [filtroRegiao, setFiltroRegiao] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(20);
  const [exibirRelatorioIdade, setExibirRelatorioIdade] = useState(false);

  // Reseta para a primeira página ao alterar o termo de busca ou filtros
  useEffect(() => {
    setPaginaAtual(1);
  }, [busca, filtroRegiao, filtroStatus]);

  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [modalLinkAberto, setModalLinkAberto] = useState(false);
  const [linkGerado, setLinkGerado] = useState("");
  const [emailEnviado, setEmailEnviado] = useState(false);
  const [erroLink, setErroLink] = useState<string | null>(null);
  const [gerandoLinkPara, setGerandoLinkPara] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, pendente] = useActionState(criarPessoa, ESTADO_INICIAL_CRIAR_PESSOA);

  // Nome e CPF ficam controlados só para o OCR (item 3) poder preenchê-los depois
  // que a pessoa confirmar a sugestão. Sem OCR, funcionam como campos normais.
  const [novoNome, setNovoNome] = useState("");
  const [novoCpf, setNovoCpf] = useState("");

  // Depois de cadastrar com sucesso: fecha o modal, limpa o formulário e busca a lista
  // de novo no servidor (o `revalidatePath` da action já invalidou o cache).
  useEffect(() => {
    if (estado.status === "sucesso") {
      setModalNovoAberto(false);
      formRef.current?.reset();
      setNovoNome("");
      setNovoCpf("");
      router.refresh();
    }
  }, [estado.status, router]);

  const pessoasFiltradas = pessoasIniciais.filter((p) => {
    const termo = busca.toLowerCase();
    const bateBusca =
      p.nomeCompleto.toLowerCase().includes(termo) || p.cpf.includes(termo.replace(/\D/g, ""));
    const bateRegiao = filtroRegiao === "todas" || p.regiaoNome === filtroRegiao;
    const bateStatus =
      filtroStatus === "todos" ||
      (filtroStatus === "apta" && p.apta) ||
      (filtroStatus === "pendente" && !p.apta) ||
      (filtroStatus === "com_pendencias" && p.pendencias.length > 0) ||
      (filtroStatus === "autoinscritos" && p.origem === "autoinscricao");
    return bateBusca && bateRegiao && bateStatus;
  });

  const totalPaginas = Math.max(1, Math.ceil(pessoasFiltradas.length / itensPorPagina));
  const paginaAjustada = Math.min(Math.max(1, paginaAtual), totalPaginas);
  const indiceInicial = (paginaAjustada - 1) * itensPorPagina;
  const pessoasExibidas = pessoasFiltradas.slice(indiceInicial, indiceInicial + itensPorPagina);

  function handleMudarItensPorPagina(novosItensPorPagina: number) {
    setItensPorPagina(novosItensPorPagina);
    setPaginaAtual(1);
  }

  function abrirModalNovo() {
    setModalNovoAberto(true);
  }

  function fecharModalNovo() {
    setModalNovoAberto(false);
    setNovoNome("");
    setNovoCpf("");
  }

  // Link público de coleta (Fase 2, item 2) — gera de verdade contra o banco
  // (links_coleta + token aleatório) e tenta enviar por e-mail via Resend.
  async function handleGerarLinkColeta(p: PessoaListada) {
    setGerandoLinkPara(p.id);
    setErroLink(null);
    const resultado = await gerarLinkColeta(p.id);
    setGerandoLinkPara(null);

    if (resultado.status === "erro") {
      setErroLink(resultado.mensagem ?? "Não foi possível gerar o link.");
      setLinkGerado("");
      setModalLinkAberto(true);
      return;
    }

    setLinkGerado(resultado.url ?? "");
    setEmailEnviado(Boolean(resultado.emailEnviado));
    setCopiado(false);
    setModalLinkAberto(true);
  }

  async function handleCopiarLink() {
    await navigator.clipboard.writeText(linkGerado);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  }

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-line pb-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-seal">
            Recursos Humanos & Colaboradores
          </span>
          <h1 className="text-h1 font-semibold text-ink">Quadro de Pessoas e Equipes</h1>
          <p className="mt-1 text-small text-ink-muted">
            Cadastro unificado com checagem de unicidade por CPF e aptidão documental.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/configuracoes?aba=regioes"
            className="text-small font-medium text-seal underline decoration-seal/40 underline-offset-4"
          >
            Regiões
          </Link>
          <Link
            href="/pessoas/importar"
            className="text-small font-medium text-seal underline decoration-seal/40 underline-offset-4"
          >
            Importar planilha
          </Link>
          <Link
            href="/configuracoes"
            className="text-small font-medium text-seal underline decoration-seal/40 underline-offset-4"
            title="Endereço público de autoinscrição — em Configurações"
          >
            Link de inscrição
          </Link>
          <button
            type="button"
            onClick={() => setExibirRelatorioIdade(!exibirRelatorioIdade)}
            className={`text-xs font-semibold px-3 py-1.5 rounded transition-all cursor-pointer inline-flex items-center gap-1.5 border ${
              exibirRelatorioIdade
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-surface-sunken hover:bg-surface text-ink border-line"
            }`}
            title="Exibir ou ocultar relatório analítico de média de idade por Função e Região"
          >
            <span>📊</span>
            <span>{exibirRelatorioIdade ? "Ocultar Média de Idade" : "Média de Idade (Função & Região)"}</span>
          </button>
          <Selo voz="selo" onClick={abrirModalNovo} className="text-xs">
            + Cadastrar Pessoa
          </Selo>
        </div>
      </div>

      {/* Relatório Analítico de Média de Idade por Função e Região */}
      {exibirRelatorioIdade && (
        <RelatorioIdadeSecao
          pessoas={pessoasIniciais}
          aoFechar={() => setExibirRelatorioIdade(false)}
          aoFiltrarNaLista={(funcao, regiao) => {
            setFiltroRegiao(regiao === "Sem região" ? "todas" : regiao);
            setBusca(funcao === "Não informada" ? "" : funcao);
            const tabelaEl = document.getElementById("tabela-pessoas");
            if (tabelaEl) {
              tabelaEl.scrollIntoView({ behavior: "smooth" });
            }
          }}
        />
      )}

      {/* Barra de Filtros e Busca */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-surface p-4 border border-line">
        <div className="sm:col-span-2">
          <Campo
            rotulo="Buscar por nome ou CPF"
            id="busca"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite o nome ou CPF para filtrar..."
          />
        </div>

        <div>
          <label htmlFor="filtro-regiao" className="block text-small font-medium text-ink mb-1.5">
            Região / Localidade
          </label>
          <select
            id="filtro-regiao"
            value={filtroRegiao}
            onChange={(e) => setFiltroRegiao(e.target.value)}
            className="w-full h-[42px] px-3 rounded-md border border-line bg-surface text-small text-ink focus:border-primary focus:ring-1 focus:ring-focus outline-none cursor-pointer transition-colors [&>option]:bg-surface [&>option]:text-ink"
          >
            <option value="todas">Todas as regiões</option>
            {regioes.map((r) => (
              <option key={r.id} value={r.nome}>
                {r.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filtro-condicao" className="block text-small font-medium text-ink mb-1.5">
            Condição Documental
          </label>
          <select
            id="filtro-condicao"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="w-full h-[42px] px-3 rounded-md border border-line bg-surface text-small text-ink focus:border-primary focus:ring-1 focus:ring-focus outline-none cursor-pointer transition-colors [&>option]:bg-surface [&>option]:text-ink"
          >
            <option value="todos">Todos os status</option>
            <option value="apta">Apenas aptos (doc aprovado)</option>
            <option value="pendente">Com pendência documental</option>
            <option value="com_pendencias">Com qualquer pendência (checklist)</option>
            <option value="autoinscritos">Somente autoinscritos</option>
          </select>
        </div>

        <div className="sm:col-span-4 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line/60 text-xs text-ink-muted">
          <span>Use os campos acima para refinar a busca individual de colaboradores.</span>
          <button
            type="button"
            onClick={() => setExibirRelatorioIdade(!exibirRelatorioIdade)}
            className="text-primary hover:underline font-medium cursor-pointer inline-flex items-center gap-1"
          >
            <span>📊</span>
            <span>
              {exibirRelatorioIdade
                ? "Ocultar painel de média de idade ↑"
                : "Gerar relatório de média de idade por Função e Região →"}
            </span>
          </button>
        </div>
      </div>

      {/* Tabela de Pessoas */}
      {pessoasFiltradas.length > 0 ? (
        <div className="border border-line bg-surface" id="tabela-pessoas">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-small">
            <thead>
              <tr className="border-b border-line bg-paper/60 font-mono text-xs text-ink-muted">
                <th className="p-3.5">Nome / Identificação</th>
                <th className="p-3.5">Função e Região</th>
                <th className="p-3.5">Contato</th>
                <th className="p-3.5 text-center">Aptidão</th>
                <th className="p-3.5 text-center">Status Contratual</th>
                <th className="p-3.5">Pendências</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pessoasExibidas.map((p) => {
                const statusBadge = statusContratoParaBadge(p.statusContrato);
                return (
                  <tr key={p.id} className="hover:bg-paper/40 transition-colors">
                    <td className="p-3.5">
                      <div className="font-medium text-ink">{p.nomeCompleto}</div>
                      <div className="font-mono text-xs text-ink-muted flex items-center gap-1.5 mt-0.5">
                        <span>{p.cpf}</span>
                        {p.idade !== null && (
                          <span
                            className="text-[0.68rem] bg-surface-sunken px-1.5 py-0.5 rounded text-ink font-sans font-medium border border-line/50"
                            title={`Data de nascimento: ${p.dataNascimento ?? "—"}`}
                          >
                            {p.idade} anos
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 text-xs">
                      <div className="text-ink font-medium">{p.funcao ?? "—"}</div>
                      <div className="text-ink-muted">{p.regiaoNome ?? "—"}</div>
                    </td>
                    <td className="p-3.5 font-mono text-xs text-ink-muted">{p.telefone ?? "—"}</td>
                    <td className="p-3.5 text-center">
                      {p.apta ? (
                        <Badge status="apta">Apto p/ Contrato</Badge>
                      ) : (
                        <Badge status="pendente">Doc Pendente</Badge>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      {statusBadge ? (
                        <Badge status={statusBadge} />
                      ) : (
                        <span className="text-xs text-ink-muted">Sem contrato</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {p.pendencias.length === 0 ? (
                        <Badge status="apta" rotuloPersonalizado="Em dia" />
                      ) : (
                        <ul className="space-y-1 text-[0.7rem] leading-tight max-w-[220px]">
                          {p.pendencias.map((pend) => (
                            <li
                              key={pend.codigo}
                              className={pend.severidade === "critica" ? "text-alert font-medium" : "text-ink-muted"}
                            >
                              {pend.severidade === "critica" ? "● " : "○ "}
                              {pend.descricao}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleGerarLinkColeta(p)}
                        disabled={gerandoLinkPara === p.id}
                        className="text-xs text-seal hover:underline cursor-pointer disabled:opacity-50 disabled:no-underline"
                        title="Gerar link de coleta exclusivo"
                      >
                        {gerandoLinkPara === p.id ? "Gerando…" : "Link"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <Paginacao
            paginaAtual={paginaAjustada}
            totalItens={pessoasFiltradas.length}
            itensPorPagina={itensPorPagina}
            aoMudarPagina={setPaginaAtual}
            aoMudarItensPorPagina={handleMudarItensPorPagina}
            rotuloItem="colaborador"
            rotuloItemPlural="colaboradores"
          />
        </div>
      ) : (
        <EstadoVazio
          titulo="Nenhuma pessoa localizada com esses filtros"
          descricao="Tente redefinir a busca por nome/CPF ou selecione outra região administrativa."
          acao={
            <Selo
              voz="neutro"
              onClick={() => {
                setBusca("");
                setFiltroRegiao("todas");
                setFiltroStatus("todos");
              }}
            >
              Limpar filtros
            </Selo>
          }
        />
      )}

      {/* MODAL: CADASTRAR NOVA PESSOA */}
      <Modal
        aberto={modalNovoAberto}
        aoFechar={fecharModalNovo}
        titulo="Cadastrar Novo Colaborador"
        descricao="Preencha os dados essenciais para iniciar a formalização contratual."
        rotuloPrimario={pendente ? "Salvando…" : "Salvar e Gerar Ficha"}
        acaoPrimaria={() => formRef.current?.requestSubmit()}
        desabilitarConfirmacao={pendente}
      >
        <form ref={formRef} action={formAction} className="space-y-4 text-small">
          {estado.status === "duplicada" && (
            <Alerta tom="atencao" titulo="Este CPF já está cadastrado">
              {estado.mensagem}
            </Alerta>
          )}
          {estado.status === "erro" && estado.mensagem && (
            <Alerta tom="critico" titulo="Não foi possível cadastrar">
              {estado.mensagem}
            </Alerta>
          )}

          <details className="border border-line bg-surface/40 text-xs">
            <summary className="cursor-pointer px-3 py-2 font-medium text-ink">
              Preencher a partir de uma foto do RG ou CNH
            </summary>
            <div className="p-3 pt-0">
              <OcrDocumento
                onConfirmar={({ nome, cpf }) => {
                  if (nome) setNovoNome(nome);
                  if (cpf) setNovoCpf(cpf);
                }}
              />
            </div>
          </details>

          <Campo
            rotulo="Nome Completo"
            id="novo-nome"
            name="fullName"
            required
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Nome civil do colaborador"
            erro={estado.status === "erro" ? estado.errors?.fullName : undefined}
          />

          <Campo
            rotulo="CPF"
            id="novo-cpf"
            name="cpf"
            mono
            required
            value={novoCpf}
            onChange={(e) => setNovoCpf(e.target.value)}
            placeholder="000.000.000-00"
            auxiliar="O sistema impedirá duplicatas dentro da mesma organização. Confira o CPF sugerido pelo OCR antes de salvar."
            erro={estado.status === "erro" ? estado.errors?.cpf : undefined}
          />

          <Campo
            rotulo="Telefone Celular (WhatsApp)"
            id="novo-tel"
            name="phone"
            mono
            placeholder="(61) 90000-0000"
          />

          <Campo.Selecao
            rotulo="Região de Atuação"
            id="novo-regiao"
            name="regionId"
            required
            defaultValue=""
            erro={estado.status === "erro" ? estado.errors?.regionId : undefined}
          >
            <option value="" disabled>
              Selecione uma região
            </option>
            {regioes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </Campo.Selecao>

          <Campo.Selecao
            rotulo="Função / Objeto"
            id="novo-funcao"
            name="role"
            defaultValue={FUNCOES_CONHECIDAS[0]}
          >
            {FUNCOES_CONHECIDAS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Campo.Selecao>
        </form>
      </Modal>

      {/* MODAL: LINK PÚBLICO DE COLETA */}
      <Modal
        aberto={modalLinkAberto}
        aoFechar={() => setModalLinkAberto(false)}
        titulo="Link de Coleta Exclusivo"
        descricao="Envie este link para o contratado preencher os dados complementares pelo celular."
        rotuloPrimario={erroLink ? undefined : copiado ? "Copiado com Sucesso ✓" : "Copiar Link"}
        acaoPrimaria={erroLink ? undefined : handleCopiarLink}
      >
        <div className="space-y-4">
          {erroLink ? (
            <Alerta tom="critico" titulo="Não foi possível gerar o link">
              {erroLink}
            </Alerta>
          ) : (
            <>
              <div className="p-3 bg-paper border border-line flex items-center justify-between">
                <span className="font-mono text-xs text-ink truncate select-all">
                  {linkGerado}
                </span>
              </div>

              {emailEnviado ? (
                <Alerta tom="sucesso" titulo="E-mail enviado">
                  O link também foi enviado por e-mail para esta pessoa.
                </Alerta>
              ) : (
                <Alerta tom="atencao" titulo="E-mail não enviado">
                  A pessoa não tem e-mail cadastrado, ou o envio falhou (sem domínio verificado no
                  Resend — decisão registrada em PROGRESSO-FASE-2-3-4.md). Copie e envie o link
                  manualmente, por WhatsApp por exemplo.
                </Alerta>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
