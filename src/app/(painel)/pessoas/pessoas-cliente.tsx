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
import { criarPessoa, gerarLinkColeta, atualizarPessoa, excluirPessoa } from "./acoes";
import { ESTADO_INICIAL_CRIAR_PESSOA } from "./estado";
import type { PessoaListada, RegiaoOpcao } from "./dados";

const FUNCOES_CONHECIDAS = [
  "Militância e Mobilização de Rua",
  "Administrativo e Montagem de Material",
  "Administrativo Homeoffice",
  "Coordenador de Comitê da Campanha",
];

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
  const [alertaGlobal, setAlertaGlobal] = useState<{
    tipo: "sucesso" | "erro";
    mensagem: string;
  } | null>(null);

  // Reseta para a primeira página ao alterar o termo de busca ou filtros
  useEffect(() => {
    setPaginaAtual(1);
  }, [busca, filtroRegiao, filtroStatus]);

  // Modais
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [modalLinkAberto, setModalLinkAberto] = useState(false);
  const [pessoaFicha, setPessoaFicha] = useState<PessoaListada | null>(null);
  const [pessoaEditando, setPessoaEditando] = useState<PessoaListada | null>(null);
  const [pessoaExcluindo, setPessoaExcluindo] = useState<PessoaListada | null>(null);

  // Estado do Link de Coleta
  const [linkGerado, setLinkGerado] = useState("");
  const [emailEnviado, setEmailEnviado] = useState(false);
  const [erroLink, setErroLink] = useState<string | null>(null);
  const [gerandoLinkPara, setGerandoLinkPara] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Estado do Modal Novo Colaborador
  const formRef = useRef<HTMLFormElement>(null);
  const [estadoCriacao, formActionCriacao, pendenteCriacao] = useActionState(
    criarPessoa,
    ESTADO_INICIAL_CRIAR_PESSOA,
  );
  const [novoNome, setNovoNome] = useState("");
  const [novoCpf, setNovoCpf] = useState("");

  // Estado do Modal de Edição
  const [editNome, setEditNome] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [editRg, setEditRg] = useState("");
  const [editDataNascimento, setEditDataNascimento] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRegiaoId, setEditRegiaoId] = useState("");
  const [editFuncao, setEditFuncao] = useState("");
  const [editCep, setEditCep] = useState("");
  const [editEndereco, setEditEndereco] = useState("");
  const [editPixKey, setEditPixKey] = useState("");
  const [editApta, setEditApta] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);
  const [errosCamposEdicao, setErrosCamposEdicao] = useState<Record<string, string>>({});

  // Estado do Modal de Exclusão
  const [motivoExclusao, setMotivoExclusao] = useState("");
  const [salvandoExclusao, setSalvandoExclusao] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  // Sincronização pós-criação bem sucedida
  useEffect(() => {
    if (estadoCriacao.status === "sucesso") {
      setModalNovoAberto(false);
      formRef.current?.reset();
      setNovoNome("");
      setNovoCpf("");
      setAlertaGlobal({ tipo: "sucesso", mensagem: "Novo colaborador cadastrado com sucesso." });
      router.refresh();
      setTimeout(() => setAlertaGlobal(null), 4000);
    }
  }, [estadoCriacao.status, router]);

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

  // Abertura do Modal de Edição
  function handleAbrirEdicao(p: PessoaListada) {
    setErroEdicao(null);
    setErrosCamposEdicao({});
    setPessoaEditando(p);
    setEditNome(p.nomeCompleto);
    setEditCpf(p.cpf);
    setEditRg(p.rg ?? "");
    setEditDataNascimento(p.dataNascimento ?? "");
    setEditTelefone(p.telefone ?? "");
    setEditEmail(p.email ?? "");
    setEditRegiaoId(p.regiaoId ?? "");
    setEditFuncao(p.funcao ?? FUNCOES_CONHECIDAS[0]);
    setEditCep(p.cep ?? "");
    setEditEndereco(p.endereco ?? "");
    setEditPixKey(p.chavePix ?? "");
    setEditApta(Boolean(p.apta));
  }

  // Busca de Endereço via CEP (ViaCEP)
  async function handleBuscarCep() {
    const cepLimpo = editCep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) {
      setErrosCamposEdicao((prev) => ({ ...prev, zipCode: "CEP deve conter 8 dígitos." }));
      return;
    }
    setBuscandoCep(true);
    setErrosCamposEdicao((prev) => {
      const copy = { ...prev };
      delete copy.zipCode;
      return copy;
    });

    try {
      const res = await fetch(`/api/cep/${cepLimpo}`);
      const dados = await res.json();
      if (dados.ok && dados.dados) {
        if (dados.dados.enderecoFormatado) {
          setEditEndereco(dados.dados.enderecoFormatado);
        }
        if (dados.dados.cep) {
          setEditCep(dados.dados.cep);
        }
      } else {
        setErrosCamposEdicao((prev) => ({
          ...prev,
          zipCode: dados.motivo || "CEP não encontrado.",
        }));
      }
    } catch {
      setErrosCamposEdicao((prev) => ({ ...prev, zipCode: "Falha ao consultar o CEP." }));
    } finally {
      setBuscandoCep(false);
    }
  }

  // Submissão do Formulário de Edição
  async function handleSalvarEdicao() {
    if (!pessoaEditando) return;
    setSalvandoEdicao(true);
    setErroEdicao(null);
    setErrosCamposEdicao({});

    const formData = new FormData();
    formData.append("id", pessoaEditando.id);
    formData.append("fullName", editNome);
    formData.append("cpf", editCpf);
    formData.append("rg", editRg);
    formData.append("birthDate", editDataNascimento);
    formData.append("phone", editTelefone);
    formData.append("email", editEmail);
    formData.append("regionId", editRegiaoId);
    formData.append("role", editFuncao);
    formData.append("zipCode", editCep);
    formData.append("address", editEndereco);
    formData.append("pixKey", editPixKey);
    formData.append("eligible", editApta ? "true" : "false");

    const resultado = await atualizarPessoa(formData);
    setSalvandoEdicao(false);

    if (!resultado.ok) {
      setErroEdicao(resultado.mensagem);
      if (resultado.errors) {
        setErrosCamposEdicao(resultado.errors);
      }
      return;
    }

    setPessoaEditando(null);
    setAlertaGlobal({ tipo: "sucesso", mensagem: resultado.mensagem });
    router.refresh();
    setTimeout(() => setAlertaGlobal(null), 4000);
  }

  // Abertura do Modal de Exclusão
  function handleAbrirExclusao(p: PessoaListada) {
    setPessoaExcluindo(p);
    setMotivoExclusao("");
    setErroExclusao(null);
  }

  // Confirmação de Exclusão
  async function handleConfirmarExclusao() {
    if (!pessoaExcluindo) return;
    setSalvandoExclusao(true);
    setErroExclusao(null);

    const resultado = await excluirPessoa(pessoaExcluindo.id, motivoExclusao);
    setSalvandoExclusao(false);

    if (!resultado.ok) {
      setErroExclusao(resultado.mensagem);
      return;
    }

    setPessoaExcluindo(null);
    setAlertaGlobal({ tipo: "sucesso", mensagem: resultado.mensagem });
    router.refresh();
    setTimeout(() => setAlertaGlobal(null), 4000);
  }

  // Geração de Link de Coleta
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
      {/* Alerta Global de Notificação */}
      {alertaGlobal && (
        <Alerta
          tom={alertaGlobal.tipo === "sucesso" ? "sucesso" : "critico"}
          titulo={alertaGlobal.tipo === "sucesso" ? "Operação realizada" : "Atenção"}
        >
          {alertaGlobal.mensagem}
        </Alerta>
      )}

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-line pb-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-seal">
            Recursos Humanos & Colaboradores
          </span>
          <h1 className="text-h1 font-semibold text-ink">Quadro de Pessoas e Equipes</h1>
          <p className="mt-1 text-small text-ink-muted">
            Cadastro unificado com checagem de unicidade por CPF, aptidão documental e administração total (CRUD).
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
                  <th className="p-3.5 text-right">Ações de Gestão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pessoasExibidas.map((p) => {
                  const statusBadge = statusContratoParaBadge(p.statusContrato);
                  return (
                    <tr key={p.id} className="hover:bg-paper/40 transition-colors">
                      <td className="p-3.5">
                        <div className="font-medium text-ink flex items-center gap-2">
                          <span>{p.nomeCompleto}</span>
                          {p.origem === "autoinscricao" && (
                            <span
                              className="text-[0.65rem] bg-surface-tint border border-primary/30 text-primary px-1.5 py-0.2 rounded font-mono"
                              title="Cadastrado via link público de autoinscrição"
                            >
                              Autoinscrito
                            </span>
                          )}
                        </div>
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
                      <td className="p-3.5 text-xs text-ink-muted">
                        <div className="font-mono">{p.telefone ?? "—"}</div>
                        {p.email && <div className="text-[0.7rem] truncate max-w-[150px]">{p.email}</div>}
                      </td>
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
                                className={
                                  pend.severidade === "critica"
                                    ? "text-alert font-medium"
                                    : "text-ink-muted"
                                }
                              >
                                {pend.severidade === "critica" ? "● " : "○ "}
                                {pend.descricao}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {/* Ficha Detalhada */}
                          <button
                            type="button"
                            onClick={() => setPessoaFicha(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-line bg-surface hover:bg-surface-sunken text-ink transition-colors cursor-pointer"
                            title="Ver ficha cadastral completa e documentos"
                          >
                            <span>👁️</span>
                            <span className="hidden xl:inline">Ficha</span>
                          </button>

                          {/* Editar */}
                          <button
                            type="button"
                            onClick={() => handleAbrirEdicao(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-line bg-surface hover:bg-surface-sunken text-seal transition-colors cursor-pointer"
                            title="Editar cadastro completo"
                          >
                            <span>✏️</span>
                            <span className="hidden xl:inline">Editar</span>
                          </button>

                          {/* Gerar Link */}
                          <button
                            type="button"
                            onClick={() => handleGerarLinkColeta(p)}
                            disabled={gerandoLinkPara === p.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-line bg-surface hover:bg-surface-sunken text-primary transition-colors cursor-pointer disabled:opacity-50"
                            title="Gerar link de autocoleta para o celular"
                          >
                            <span>🔗</span>
                            <span className="hidden xl:inline">
                              {gerandoLinkPara === p.id ? "..." : "Link"}
                            </span>
                          </button>

                          {/* Excluir */}
                          <button
                            type="button"
                            onClick={() => handleAbrirExclusao(p)}
                            className="inline-flex items-center justify-center p-1 px-2 text-xs font-semibold rounded border border-alert/30 bg-alert/10 hover:bg-alert/20 text-alert transition-colors cursor-pointer"
                            title="Excluir cadastro com auditoria"
                          >
                            <span>🗑️</span>
                          </button>
                        </div>
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

      {/* =========================================================================
          MODAL 1: CADASTRAR NOVA PESSOA (CREATE)
         ========================================================================= */}
      <Modal
        aberto={modalNovoAberto}
        aoFechar={fecharModalNovo}
        titulo="Cadastrar Novo Colaborador"
        descricao="Preencha os dados essenciais para iniciar a formalização contratual."
        rotuloPrimario={pendenteCriacao ? "Salvando…" : "Salvar e Gerar Ficha"}
        acaoPrimaria={() => formRef.current?.requestSubmit()}
        desabilitarConfirmacao={pendenteCriacao}
      >
        <form ref={formRef} action={formActionCriacao} className="space-y-4 text-small">
          {estadoCriacao.status === "duplicada" && (
            <Alerta tom="atencao" titulo="Este CPF já está cadastrado">
              {estadoCriacao.mensagem}
            </Alerta>
          )}
          {estadoCriacao.status === "erro" && estadoCriacao.mensagem && (
            <Alerta tom="critico" titulo="Não foi possível cadastrar">
              {estadoCriacao.mensagem}
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
            erro={estadoCriacao.status === "erro" ? estadoCriacao.errors?.fullName : undefined}
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
            auxiliar="O sistema impedirá duplicatas dentro da mesma organização."
            erro={estadoCriacao.status === "erro" ? estadoCriacao.errors?.cpf : undefined}
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
            erro={estadoCriacao.status === "erro" ? estadoCriacao.errors?.regionId : undefined}
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

      {/* =========================================================================
          MODAL 2: VISUALIZAR FICHA CADASTRAL COMPLETA (READ)
         ========================================================================= */}
      <Modal
        aberto={Boolean(pessoaFicha)}
        aoFechar={() => setPessoaFicha(null)}
        titulo={`Ficha do Colaborador — ${pessoaFicha?.nomeCompleto ?? ""}`}
        descricao="Dossiê cadastral, aptidão e situação de conformidade documental."
        larguraMaxima="max-w-2xl"
        rotuloSecundario="Fechar"
        rotuloPrimario="Editar Cadastro"
        acaoPrimaria={() => {
          if (pessoaFicha) {
            const p = pessoaFicha;
            setPessoaFicha(null);
            handleAbrirEdicao(p);
          }
        }}
      >
        {pessoaFicha && (
          <div className="space-y-5 text-small">
            {/* Cabeçalho do Card */}
            <div className="flex items-center justify-between p-4 bg-surface-sunken border border-line rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-sm">
                  {pessoaFicha.nomeCompleto
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-ink">{pessoaFicha.nomeCompleto}</h3>
                  <p className="font-mono text-xs text-ink-muted">
                    CPF: {pessoaFicha.cpf}
                    {pessoaFicha.idade !== null && ` · ${pessoaFicha.idade} anos`}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {pessoaFicha.apta ? (
                  <Badge status="apta">Apto p/ Contrato</Badge>
                ) : (
                  <Badge status="pendente">Doc Pendente</Badge>
                )}
                {statusContratoParaBadge(pessoaFicha.statusContrato) ? (
                  <Badge status={statusContratoParaBadge(pessoaFicha.statusContrato)!} />
                ) : (
                  <span className="text-[0.7rem] text-ink-muted">Sem contrato</span>
                )}
              </div>
            </div>

            {/* Grid de Seções */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Bloco 1: Dados Pessoais */}
              <div className="p-3.5 bg-surface border border-line rounded-md space-y-2">
                <span className="font-mono text-[0.68rem] uppercase font-bold tracking-wider text-seal block">
                  Identificação & Registro
                </span>
                <div className="text-xs space-y-1 text-ink">
                  <div>
                    <span className="text-ink-muted">RG: </span>
                    <span className="font-mono font-medium">{pessoaFicha.rg || "Não informado"}</span>
                  </div>
                  <div>
                    <span className="text-ink-muted">Nascimento: </span>
                    <span className="font-medium">
                      {pessoaFicha.dataNascimento
                        ? new Date(pessoaFicha.dataNascimento + "T00:00:00").toLocaleDateString("pt-BR")
                        : "Não informada"}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-muted">Origem: </span>
                    <span className="font-medium">
                      {pessoaFicha.origem === "autoinscricao"
                        ? "Link público de autoinscrição"
                        : "Cadastro direto no painel"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bloco 2: Contato & Chave PIX */}
              <div className="p-3.5 bg-surface border border-line rounded-md space-y-2">
                <span className="font-mono text-[0.68rem] uppercase font-bold tracking-wider text-seal block">
                  Contato & Dados Financeiros
                </span>
                <div className="text-xs space-y-1 text-ink">
                  <div>
                    <span className="text-ink-muted">Telefone: </span>
                    <span className="font-mono font-medium">{pessoaFicha.telefone || "Não informado"}</span>
                  </div>
                  <div>
                    <span className="text-ink-muted">E-mail: </span>
                    <span className="font-medium">{pessoaFicha.email || "Não informado"}</span>
                  </div>
                  <div>
                    <span className="text-ink-muted">Chave PIX: </span>
                    <span className="font-mono font-medium text-primary">
                      {pessoaFicha.chavePix || "Não cadastrada"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bloco 3: Alocação & Função */}
              <div className="p-3.5 bg-surface border border-line rounded-md space-y-2">
                <span className="font-mono text-[0.68rem] uppercase font-bold tracking-wider text-seal block">
                  Alocação na Campanha
                </span>
                <div className="text-xs space-y-1 text-ink">
                  <div>
                    <span className="text-ink-muted">Região: </span>
                    <span className="font-medium">{pessoaFicha.regiaoNome || "Sem região vinculada"}</span>
                  </div>
                  <div>
                    <span className="text-ink-muted">Função: </span>
                    <span className="font-medium">{pessoaFicha.funcao || "Não informada"}</span>
                  </div>
                  <div>
                    <span className="text-ink-muted">Contratos emitidos: </span>
                    <span className="font-mono font-medium">{pessoaFicha.totalContratos}</span>
                  </div>
                </div>
              </div>

              {/* Bloco 4: Endereço Residencial */}
              <div className="p-3.5 bg-surface border border-line rounded-md space-y-2">
                <span className="font-mono text-[0.68rem] uppercase font-bold tracking-wider text-seal block">
                  Endereço Residencial
                </span>
                <div className="text-xs space-y-1 text-ink">
                  <div>
                    <span className="text-ink-muted">CEP: </span>
                    <span className="font-mono font-medium">{pessoaFicha.cep || "Não informado"}</span>
                  </div>
                  <div>
                    <span className="text-ink-muted">Logradouro: </span>
                    <span className="font-medium">{pessoaFicha.endereco || "Não informado"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Checklist e Documentos Enviados */}
            <div className="p-4 bg-surface border border-line rounded-md space-y-3">
              <span className="font-mono text-[0.68rem] uppercase font-bold tracking-wider text-seal block">
                Situação Documental & Checklist de Conformidade
              </span>

              {pessoaFicha.documentosResumo.length > 0 ? (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-ink block">Documentos Registrados:</span>
                  <div className="flex flex-wrap gap-2">
                    {pessoaFicha.documentosResumo.map((doc, idx) => (
                      <span
                        key={idx}
                        className={`text-xs px-2.5 py-1 rounded border inline-flex items-center gap-1.5 ${
                          doc.status === "aprovado"
                            ? "bg-positive/10 border-positive/30 text-positive-text"
                            : doc.status === "rejeitado"
                              ? "bg-alert/10 border-alert/30 text-alert"
                              : "bg-surface-sunken border-line text-ink-muted"
                        }`}
                      >
                        <span className="font-medium capitalize">{doc.tipo}</span>
                        <span className="text-[0.65rem] font-mono uppercase">({doc.status})</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-ink-muted">
                  Nenhum documento foi enviado ainda por este colaborador.
                </p>
              )}

              {pessoaFicha.pendencias.length > 0 && (
                <div className="pt-2 border-t border-line/60">
                  <span className="text-xs font-semibold text-alert block mb-1">
                    Pendências a Regularizar:
                  </span>
                  <ul className="space-y-1 text-xs text-ink-muted">
                    {pessoaFicha.pendencias.map((pend) => (
                      <li key={pend.codigo} className="flex items-center gap-1.5">
                        <span className={pend.severidade === "critica" ? "text-alert" : "text-ink-muted"}>
                          {pend.severidade === "critica" ? "●" : "○"}
                        </span>
                        <span>{pend.descricao}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* =========================================================================
          MODAL 3: EDITAR COLABORADOR (UPDATE)
         ========================================================================= */}
      <Modal
        aberto={Boolean(pessoaEditando)}
        aoFechar={() => setPessoaEditando(null)}
        titulo="Editar Dados do Colaborador"
        descricao="Atualize os dados cadastrais, cargo, endereço e status de aptidão contratual."
        larguraMaxima="max-w-2xl"
        rotuloPrimario={salvandoEdicao ? "Salvando…" : "Salvar Alterações"}
        rotuloSecundario="Cancelar"
        acaoPrimaria={handleSalvarEdicao}
        desabilitarConfirmacao={salvandoEdicao}
      >
        <div className="space-y-4 text-small">
          {erroEdicao && (
            <Alerta tom="critico" titulo="Não foi possível salvar as alterações">
              {erroEdicao}
            </Alerta>
          )}

          {/* Grid de Edição */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Campo
                rotulo="Nome Completo"
                id="edit-nome"
                required
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                placeholder="Nome civil do colaborador"
                erro={errosCamposEdicao.fullName}
              />
            </div>

            <div>
              <Campo
                rotulo="CPF"
                id="edit-cpf"
                mono
                required
                value={editCpf}
                onChange={(e) => setEditCpf(e.target.value)}
                placeholder="000.000.000-00"
                erro={errosCamposEdicao.cpf}
              />
            </div>

            <div>
              <Campo
                rotulo="RG / Órgão Expedidor"
                id="edit-rg"
                value={editRg}
                onChange={(e) => setEditRg(e.target.value)}
                placeholder="Ex: 0000000 SSP/DF"
                erro={errosCamposEdicao.rg}
              />
            </div>

            <div>
              <Campo
                rotulo="Data de Nascimento"
                id="edit-nascimento"
                type="date"
                value={editDataNascimento}
                onChange={(e) => setEditDataNascimento(e.target.value)}
                erro={errosCamposEdicao.birthDate}
              />
            </div>

            <div>
              <Campo
                rotulo="Telefone Celular (WhatsApp)"
                id="edit-telefone"
                mono
                value={editTelefone}
                onChange={(e) => setEditTelefone(e.target.value)}
                placeholder="(61) 90000-0000"
                erro={errosCamposEdicao.phone}
              />
            </div>

            <div className="sm:col-span-2">
              <Campo
                rotulo="E-mail"
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="colaborador@email.com"
                erro={errosCamposEdicao.email}
              />
            </div>

            <div>
              <label htmlFor="edit-regiao" className="block text-small font-medium text-ink mb-1.5">
                Região de Atuação <span className="text-alert">*</span>
              </label>
              <select
                id="edit-regiao"
                value={editRegiaoId}
                onChange={(e) => setEditRegiaoId(e.target.value)}
                className="w-full h-[42px] px-3 rounded-md border border-line bg-surface text-small text-ink focus:border-primary focus:ring-1 focus:ring-focus outline-none cursor-pointer transition-colors [&>option]:bg-surface [&>option]:text-ink"
              >
                <option value="" disabled>
                  Selecione uma região
                </option>
                {regioes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
              {errosCamposEdicao.regionId && (
                <p className="mt-1 text-xs text-alert">{errosCamposEdicao.regionId}</p>
              )}
            </div>

            <div>
              <label htmlFor="edit-funcao" className="block text-small font-medium text-ink mb-1.5">
                Função / Cargo
              </label>
              <select
                id="edit-funcao"
                value={editFuncao}
                onChange={(e) => setEditFuncao(e.target.value)}
                className="w-full h-[42px] px-3 rounded-md border border-line bg-surface text-small text-ink focus:border-primary focus:ring-1 focus:ring-focus outline-none cursor-pointer transition-colors [&>option]:bg-surface [&>option]:text-ink"
              >
                {FUNCOES_CONHECIDAS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {/* CEP com Busca ViaCEP */}
            <div>
              <label htmlFor="edit-cep" className="block text-small font-medium text-ink mb-1.5">
                CEP (Autopreenchimento)
              </label>
              <div className="flex gap-2">
                <input
                  id="edit-cep"
                  type="text"
                  value={editCep}
                  onChange={(e) => setEditCep(e.target.value)}
                  placeholder="00000-000"
                  className="w-full h-[42px] px-3 rounded-md border border-line bg-surface text-small font-mono text-ink focus:border-primary focus:ring-1 focus:ring-focus outline-none"
                />
                <button
                  type="button"
                  onClick={handleBuscarCep}
                  disabled={buscandoCep}
                  className="px-3 h-[42px] rounded-md border border-line bg-surface-sunken hover:bg-surface text-xs font-semibold text-ink cursor-pointer disabled:opacity-50 whitespace-nowrap transition-colors"
                >
                  {buscandoCep ? "Buscando…" : "Buscar CEP"}
                </button>
              </div>
              {errosCamposEdicao.zipCode && (
                <p className="mt-1 text-xs text-alert">{errosCamposEdicao.zipCode}</p>
              )}
            </div>

            <div>
              <Campo
                rotulo="Chave PIX (para pagamento)"
                id="edit-pix"
                value={editPixKey}
                onChange={(e) => setEditPixKey(e.target.value)}
                placeholder="CPF, Telefone, E-mail ou Aleatória"
                erro={errosCamposEdicao.pixKey}
              />
            </div>

            <div className="sm:col-span-2">
              <Campo
                rotulo="Endereço Residencial Completo"
                id="edit-endereco"
                value={editEndereco}
                onChange={(e) => setEditEndereco(e.target.value)}
                placeholder="Logradouro, número, complemento, bairro, cidade - UF"
                erro={errosCamposEdicao.address}
              />
            </div>

            {/* Switch de Aptidão */}
            <div className="sm:col-span-2 p-3.5 bg-surface-sunken border border-line rounded-md flex items-center justify-between">
              <div>
                <span className="font-semibold text-ink text-xs block">
                  Aptidão para Emissão de Contrato
                </span>
                <span className="text-[0.72rem] text-ink-muted">
                  Colaboradores aptos podem ter contratos gerados e assinados eletronicamente.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={editApta}
                  onChange={(e) => setEditApta(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>
      </Modal>

      {/* =========================================================================
          MODAL 4: EXCLUIR COLABORADOR (DELETE COM ARQUIVAMENTO EM DADOSEXCLUIDOS)
         ========================================================================= */}
      <Modal
        aberto={Boolean(pessoaExcluindo)}
        aoFechar={() => setPessoaExcluindo(null)}
        titulo="Excluir Colaborador do Painel"
        descricao="Ação de remoção com arquivamento obrigatório de auditoria e conformidade."
        rotuloPrimario={salvandoExclusao ? "Excluindo…" : "Excluir Definitivamente"}
        rotuloSecundario="Cancelar"
        vozPrimaria="perigo"
        acaoPrimaria={handleConfirmarExclusao}
        desabilitarConfirmacao={
          salvandoExclusao ||
          Boolean(pessoaExcluindo && pessoaExcluindo.totalContratos > 0 && pessoaExcluindo.statusContrato !== "cancelado")
        }
      >
        {pessoaExcluindo && (
          <div className="space-y-4 text-small">
            {erroExclusao && (
              <Alerta tom="critico" titulo="Não foi possível excluir">
                {erroExclusao}
              </Alerta>
            )}

            {pessoaExcluindo.totalContratos > 0 && pessoaExcluindo.statusContrato !== "cancelado" ? (
              <Alerta tom="critico" titulo="Exclusão Bloqueada por Integridade Contratual">
                Este colaborador possui contrato(s) registrado(s) no sistema (status atual:{" "}
                <strong>{pessoaExcluindo.statusContrato ?? "registrado"}</strong>). Para preservar a
                prestação de contas e a conformidade eleitoral perante a Justiça Eleitoral, colaboradores
                com contratos emitidos ou assinados não podem ser deletados diretamente. Cancele ou
                distrate o contrato primeiro caso queira descontinuar.
              </Alerta>
            ) : (
              <>
                <Alerta tom="atencao" titulo="Atenção — Remoção Irreversível">
                  Você está prestes a excluir o cadastro de{" "}
                  <strong>{pessoaExcluindo.nomeCompleto}</strong> (CPF {pessoaExcluindo.cpf}). Todos os
                  documentos e dados serão arquivados na tabela de auditoria cívica (
                  <code>DadosExcluidos</code>) com seu login de gestor e data/hora.
                </Alerta>

                <div>
                  <label htmlFor="motivo-exclusao" className="block text-xs font-medium text-ink mb-1.5">
                    Motivo da Exclusão (opcional, para fins de auditoria):
                  </label>
                  <textarea
                    id="motivo-exclusao"
                    rows={3}
                    value={motivoExclusao}
                    onChange={(e) => setMotivoExclusao(e.target.value)}
                    placeholder="Ex: Cadastro duplicado por engano / desistência do colaborador..."
                    className="w-full p-2.5 rounded-md border border-line bg-surface text-small text-ink focus:border-primary focus:ring-1 focus:ring-focus outline-none"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* =========================================================================
          MODAL 5: LINK PÚBLICO DE COLETA
         ========================================================================= */}
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
                  Resend). Copie e envie o link manualmente por WhatsApp.
                </Alerta>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
