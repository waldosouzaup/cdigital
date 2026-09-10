"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alerta } from "@/components/alerta";
import { Badge } from "@/components/badge";
import { Campo } from "@/components/campo";
import { Modal } from "@/components/modal";
import { Selo } from "@/components/selo";
import { EstadoVazio } from "@/components/estado-vazio";
import type { MembroEquipe } from "../equipe/dados";
import type { RegiaoOpcao } from "../pessoas/dados";

const TODOS_PAPEIS: { valor: string; rotulo: string }[] = [
  { valor: "superadmin", rotulo: "Super Administrador" },
  { valor: "gestor", rotulo: "Gestor" },
  { valor: "coord_comite", rotulo: "Coordenador de Comitê" },
  { valor: "coord_regiao", rotulo: "Coordenador Regional" },
  { valor: "auditor", rotulo: "Auditor" },
  { valor: "contratado", rotulo: "Contratado" },
];

function rotuloPapel(valor: string): string {
  return TODOS_PAPEIS.find((p) => p.valor === valor)?.rotulo ?? valor;
}

function formatarData(dataIso?: string): string {
  if (!dataIso) return "—";
  try {
    const d = new Date(dataIso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dataIso;
  }
}

export function EquipeSecao({
  membrosIniciais,
  regioes,
  usuarioLogado,
}: {
  membrosIniciais: MembroEquipe[];
  regioes: RegiaoOpcao[];
  usuarioLogado?: { id: string | null; papel?: string };
}) {
  const router = useRouter();
  const isSuperAdmin = usuarioLogado?.papel === "superadmin";

  // Papéis disponíveis para seleção no formulário (superadmin só selecionável por superadmin)
  const papeisDisponiveis = TODOS_PAPEIS.filter(
    (p) => p.valor !== "superadmin" || isSuperAdmin,
  );

  // Senha temporária devolvida por convite ou redefinição — exibida UMA única vez
  const [credencial, setCredencial] = useState<{ email: string; senha: string } | null>(null);
  const [credencialCopiada, setCredencialCopiada] = useState(false);

  // 1. VISUALIZAR MEMBRO (READ)
  const [membroDetalhes, setMembroDetalhes] = useState<MembroEquipe | null>(null);
  const [idCopiado, setIdCopiado] = useState(false);

  async function copiarId(id: string) {
    await navigator.clipboard.writeText(id);
    setIdCopiado(true);
    setTimeout(() => setIdCopiado(false), 2000);
  }

  // 2. CONVIDAR MEMBRO (CREATE)
  const [modalConvite, setModalConvite] = useState(false);
  const [conviteEnviando, iniciarConvite] = useTransition();
  const [conviteErro, setConviteErro] = useState<string | null>(null);
  const conviteFormRef = useRef<HTMLFormElement>(null);
  const [convitePapel, setConvitePapel] = useState("coord_comite");

  function enviarConvite() {
    const form = conviteFormRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const email = String(fd.get("email") ?? "").trim();
    const corpo = {
      nome: String(fd.get("nome") ?? "").trim(),
      email,
      papel: String(fd.get("papel") ?? "").trim(),
      regiaoId: String(fd.get("regiaoId") ?? "").trim(),
    };
    setConviteErro(null);
    iniciarConvite(async () => {
      const resp = await fetch("/api/equipe/convite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const dados = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        erro?: string;
        erros?: Record<string, string>;
        senhaTemporaria?: string;
      };
      if (!resp.ok || !dados.ok) {
        const primeiroErro = dados.erros ? Object.values(dados.erros)[0] : undefined;
        setConviteErro(dados.erro ?? primeiroErro ?? "Não foi possível enviar o convite.");
        return;
      }
      setModalConvite(false);
      form.reset();
      setConvitePapel("coord_comite");
      if (dados.senhaTemporaria) setCredencial({ email, senha: dados.senhaTemporaria });
      router.refresh();
    });
  }

  // 3. EDITAR MEMBRO (UPDATE COMPLETO)
  const [membroEditando, setMembroEditando] = useState<MembroEquipe | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPapel, setEditPapel] = useState("");
  const [editRegiaoId, setEditRegiaoId] = useState("");
  const [edicaoErro, setEdicaoErro] = useState<string | null>(null);
  const [edicaoEnviando, iniciarEdicao] = useTransition();

  function abrirEdicao(membro: MembroEquipe) {
    setMembroEditando(membro);
    setEditNome(membro.nome);
    setEditEmail(membro.email);
    setEditPapel(membro.papel);
    setEditRegiaoId(membro.regiaoId ?? "");
    setEdicaoErro(null);
  }

  function salvarEdicao() {
    if (!membroEditando) return;
    setEdicaoErro(null);
    iniciarEdicao(async () => {
      const resp = await fetch("/api/equipe/convite", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: membroEditando.id,
          nome: editNome,
          email: editEmail,
          papel: editPapel,
          regiaoId: editPapel === "coord_regiao" ? editRegiaoId : "",
        }),
      });
      const dados = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        erro?: string;
        erros?: Record<string, string>;
      };
      if (!resp.ok || !dados.ok) {
        const primeiroErro = dados.erros ? Object.values(dados.erros)[0] : undefined;
        setEdicaoErro(dados.erro ?? primeiroErro ?? "Não foi possível atualizar o membro.");
        return;
      }
      setMembroEditando(null);
      router.refresh();
    });
  }

  // 4. EXCLUIR MEMBRO (DELETE COM AUDITORIA DADOSEXCLUIDOS)
  const [membroExcluindo, setMembroExcluindo] = useState<MembroEquipe | null>(null);
  const [motivoExclusao, setMotivoExclusao] = useState("");
  const [exclusaoErro, setExclusaoErro] = useState<string | null>(null);
  const [exclusaoEnviando, iniciarExclusao] = useTransition();

  const isAutoExclusao = membroExcluindo?.id === usuarioLogado?.id;

  function confirmarExclusao() {
    if (!membroExcluindo || isAutoExclusao) return;
    setExclusaoErro(null);
    iniciarExclusao(async () => {
      const resp = await fetch("/api/equipe/convite", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: membroExcluindo.id,
          motivo: motivoExclusao,
        }),
      });
      const dados = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        erro?: string;
        mensagem?: string;
      };
      if (!resp.ok || !dados.ok) {
        setExclusaoErro(dados.erro ?? "Não foi possível excluir o membro.");
        return;
      }
      setMembroExcluindo(null);
      router.refresh();
    });
  }

  // 5. REDEFINIR SENHA
  const [redefinindoId, setRedefinindoId] = useState<string | null>(null);

  async function redefinirSenha(membro: MembroEquipe) {
    setRedefinindoId(membro.id);
    const resp = await fetch("/api/equipe/convite", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: membro.id, acao: "redefinir-senha" }),
    });
    const dados = (await resp.json().catch(() => ({}))) as { ok?: boolean; senhaTemporaria?: string };
    setRedefinindoId(null);
    if (resp.ok && dados.ok && dados.senhaTemporaria) {
      setCredencial({ email: membro.email, senha: dados.senhaTemporaria });
    }
  }

  async function copiarCredencial() {
    if (!credencial) return;
    await navigator.clipboard.writeText(`${credencial.email} / ${credencial.senha}`);
    setCredencialCopiada(true);
    setTimeout(() => setCredencialCopiada(false), 2000);
  }

  // 6. (DES)ATIVAR ACESSO
  const [alternandoId, setAlternandoId] = useState<string | null>(null);

  async function alternarAtivo(membro: MembroEquipe) {
    setAlternandoId(membro.id);
    const resp = await fetch("/api/equipe/convite", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: membro.id, ativo: !membro.ativo }),
    });
    setAlternandoId(null);
    if (resp.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-h2 font-semibold text-ink">Equipe &amp; Acessos</h2>
          <p className="mt-1 text-small text-ink-muted">
            Cadastre, edite informações, atribua regiões, alterne papéis e administre
            o ciclo de vida dos colaboradores com controle e auditoria completos.
          </p>
        </div>
        <Selo voz="selo" onClick={() => setModalConvite(true)} className="shrink-0 text-xs">
          + Convidar membro
        </Selo>
      </div>

      <Alerta tom="informativo">
        O sistema possui controle completo de <strong>CRUD</strong> para membros da equipe. Convidar
        ou redefinir a senha gera uma <strong>senha temporária</strong> única. A exclusão de membros
        é resguardada por travas de segurança e mantém um arquivamento permanente na tabela{" "}
        <strong>DadosExcluidos</strong>.
      </Alerta>

      {membrosIniciais.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum membro cadastrado"
          descricao="Convide o primeiro membro ou coordenador no botão acima."
        />
      ) : (
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="w-full min-w-[48rem] text-small">
            <thead className="border-b border-line bg-surface-sunken text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="p-3">Membro</th>
                <th className="p-3">Papel</th>
                <th className="p-3">Região</th>
                <th className="p-3">Situação</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {membrosIniciais.map((m) => (
                <tr key={m.id} className={m.ativo ? "hover:bg-surface-sunken/40" : "opacity-60 bg-surface-sunken/20"}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <span className="block font-medium text-ink">{m.nome}</span>
                        <span className="block font-mono text-xs text-ink-muted">{m.email}</span>
                      </div>
                      {m.id === usuarioLogado?.id && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[0.65rem] font-semibold text-primary">
                          Você
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge
                      status={m.papel === "superadmin" ? "apta" : "neutro"}
                      rotuloPersonalizado={rotuloPapel(m.papel)}
                    />
                  </td>
                  <td className="p-3 text-ink-muted">{m.regiaoNome ?? "—"}</td>
                  <td className="p-3">
                    <Badge
                      status={m.ativo ? "apta" : "cancelado"}
                      rotuloPersonalizado={m.ativo ? "Ativo" : "Desativado"}
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setMembroDetalhes(m)}
                        className="px-2 py-1 text-xs font-medium text-ink bg-surface-sunken hover:bg-line/40 rounded border border-line transition cursor-pointer"
                        title="Visualizar todos os detalhes deste membro"
                      >
                        Visualizar
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirEdicao(m)}
                        className="px-2 py-1 text-xs font-medium text-seal bg-seal/5 hover:bg-seal/10 rounded border border-seal/20 transition cursor-pointer"
                        title="Editar nome, e-mail, papel e região"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => redefinirSenha(m)}
                        disabled={redefinindoId === m.id}
                        className="px-2 py-1 text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface-sunken rounded transition cursor-pointer disabled:opacity-50"
                        title="Gerar nova senha temporária"
                      >
                        {redefinindoId === m.id ? "…" : "Senha"}
                      </button>
                      <button
                        type="button"
                        onClick={() => alternarAtivo(m)}
                        disabled={alternandoId === m.id}
                        className="px-2 py-1 text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface-sunken rounded transition cursor-pointer disabled:opacity-50"
                        title={m.ativo ? "Desativar acesso" : "Reativar acesso"}
                      >
                        {alternandoId === m.id ? "…" : m.ativo ? "Desativar" : "Reativar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMembroExcluindo(m);
                          setExclusaoErro(null);
                          setMotivoExclusao("");
                        }}
                        className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition cursor-pointer"
                        title="Excluir membro da equipe"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: VISUALIZAR DETALHES DO MEMBRO */}
      <Modal
        aberto={membroDetalhes !== null}
        aoFechar={() => setMembroDetalhes(null)}
        titulo="Detalhes do Membro da Equipe"
        descricao="Informações cadastrais completas e status de acesso no sistema."
        rotuloPrimario="Editar este membro"
        acaoPrimaria={() => {
          if (membroDetalhes) {
            const m = membroDetalhes;
            setMembroDetalhes(null);
            abrirEdicao(m);
          }
        }}
        rotuloSecundario="Fechar"
      >
        {membroDetalhes && (
          <div className="space-y-4 text-small">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded border border-line bg-surface-sunken/40 p-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-ink-muted font-medium block">
                  Nome Completo
                </span>
                <span className="text-base font-semibold text-ink block mt-0.5">
                  {membroDetalhes.nome}
                </span>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-ink-muted font-medium block">
                  E-mail de Acesso
                </span>
                <span className="text-base font-mono text-ink block mt-0.5 select-all">
                  {membroDetalhes.email}
                </span>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-ink-muted font-medium block">
                  Papel no Sistema
                </span>
                <div className="mt-1">
                  <Badge
                    status={membroDetalhes.papel === "superadmin" ? "apta" : "neutro"}
                    rotuloPersonalizado={rotuloPapel(membroDetalhes.papel)}
                  />
                </div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-ink-muted font-medium block">
                  Situação do Acesso
                </span>
                <div className="mt-1">
                  <Badge
                    status={membroDetalhes.ativo ? "apta" : "cancelado"}
                    rotuloPersonalizado={membroDetalhes.ativo ? "Acesso Ativo" : "Acesso Desativado"}
                  />
                </div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-ink-muted font-medium block">
                  Região Vinculada
                </span>
                <span className="text-small text-ink block mt-0.5">
                  {membroDetalhes.regiaoNome ?? "Nenhuma região vinculada (Acesso geral)"}
                </span>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-ink-muted font-medium block">
                  Data de Cadastro
                </span>
                <span className="text-small text-ink block mt-0.5">
                  {formatarData(membroDetalhes.criadoEm)}
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs uppercase tracking-wider text-ink-muted font-medium block">
                ID do Usuário (UUID)
              </span>
              <div className="mt-1 flex items-center justify-between gap-2 rounded border border-line bg-surface p-2 font-mono text-xs text-ink">
                <span className="truncate select-all">{membroDetalhes.id}</span>
                <button
                  type="button"
                  onClick={() => copiarId(membroDetalhes.id)}
                  className="shrink-0 font-sans text-xs text-seal font-medium hover:underline cursor-pointer"
                >
                  {idCopiado ? "Copiado ✓" : "Copiar ID"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 2: CONVIDAR MEMBRO (CREATE) */}
      <Modal
        aberto={modalConvite}
        aoFechar={() => setModalConvite(false)}
        titulo="Convidar membro"
        descricao="Cria o acesso com uma senha temporária, que será exibida na próxima tela."
        rotuloPrimario={conviteEnviando ? "Enviando…" : "Enviar convite"}
        acaoPrimaria={enviarConvite}
        desabilitarConfirmacao={conviteEnviando}
      >
        <form ref={conviteFormRef} className="space-y-4">
          {conviteErro && <Alerta tom="critico">{conviteErro}</Alerta>}
          <Campo rotulo="Nome completo" id="convite-nome" name="nome" required maxLength={120} />
          <Campo rotulo="E-mail de acesso" id="convite-email" name="email" type="email" required />
          <Campo.Selecao
            rotulo="Papel"
            id="convite-papel"
            name="papel"
            value={convitePapel}
            onChange={(e) => setConvitePapel(e.target.value)}
          >
            {papeisDisponiveis.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </Campo.Selecao>
          {convitePapel === "coord_regiao" && (
            <Campo.Selecao rotulo="Região de atuação" id="convite-regiao" name="regiaoId" defaultValue="">
              <option value="" disabled>
                Selecione uma região
              </option>
              {regioes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </Campo.Selecao>
          )}
        </form>
      </Modal>

      {/* MODAL 3: EDITAR MEMBRO (UPDATE COMPLETO) */}
      <Modal
        aberto={membroEditando !== null}
        aoFechar={() => setMembroEditando(null)}
        titulo={membroEditando ? `Editar Membro — ${membroEditando.nome}` : "Editar Membro"}
        descricao="Altere os dados cadastrais, e-mail de acesso, papel ou vínculo regional."
        rotuloPrimario={edicaoEnviando ? "Salvando…" : "Salvar alterações"}
        acaoPrimaria={salvarEdicao}
        desabilitarConfirmacao={edicaoEnviando}
      >
        <div className="space-y-4">
          {edicaoErro && <Alerta tom="critico">{edicaoErro}</Alerta>}
          <Campo
            rotulo="Nome completo"
            id="edit-nome"
            value={editNome}
            onChange={(e) => setEditNome(e.target.value)}
            required
            maxLength={120}
          />
          <Campo
            rotulo="E-mail de acesso"
            id="edit-email"
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            required
          />
          <Campo.Selecao
            rotulo="Papel"
            id="edit-papel"
            value={editPapel}
            onChange={(e) => setEditPapel(e.target.value)}
          >
            {papeisDisponiveis.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </Campo.Selecao>
          {editPapel === "coord_regiao" && (
            <Campo.Selecao
              rotulo="Região de atuação"
              id="edit-regiao"
              value={editRegiaoId}
              onChange={(e) => setEditRegiaoId(e.target.value)}
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
          )}
        </div>
      </Modal>

      {/* MODAL 4: EXCLUIR MEMBRO (DELETE COM ARQUIVAMENTO EM DADOSEXCLUIDOS) */}
      <Modal
        aberto={membroExcluindo !== null}
        aoFechar={() => setMembroExcluindo(null)}
        titulo="Excluir Membro da Equipe"
        descricao="Confirmação de exclusão com arquivamento permanente para governança e auditoria."
        rotuloPrimario={exclusaoEnviando ? "Excluindo…" : "Excluir Definitivamente"}
        vozPrimaria="perigo"
        acaoPrimaria={confirmarExclusao}
        desabilitarConfirmacao={exclusaoEnviando || isAutoExclusao}
      >
        {membroExcluindo && (
          <div className="space-y-4">
            {exclusaoErro && <Alerta tom="critico">{exclusaoErro}</Alerta>}

            {isAutoExclusao ? (
              <Alerta tom="critico">
                Você não pode excluir seu próprio usuário logado. Solicite a outro gestor
                se a exclusão da sua conta for necessária.
              </Alerta>
            ) : (
              <Alerta tom="atencao">
                O membro <strong>{membroExcluindo.nome}</strong> ({membroExcluindo.email}) será removido
                do painel e seu acesso revogado. Por conformidade cívica e LGPD, um snapshot dos
                dados será arquivado na tabela <strong>DadosExcluidos</strong> com o registro do executor.
              </Alerta>
            )}

            {!isAutoExclusao && (
              <Campo
                rotulo="Motivo da exclusão (opcional)"
                id="exclusao-motivo"
                placeholder="Ex: Desligamento do projeto, substituição ou fim de contrato"
                value={motivoExclusao}
                onChange={(e) => setMotivoExclusao(e.target.value)}
              />
            )}
          </div>
        )}
      </Modal>

      {/* MODAL 5: SENHA TEMPORÁRIA (EXIBIDA UMA VEZ) */}
      <Modal
        aberto={credencial !== null}
        aoFechar={() => setCredencial(null)}
        titulo="Senha temporária gerada"
        descricao="Anote agora — não será exibida novamente. Entregue por um canal seguro; o membro é obrigado a trocá-la no primeiro login."
        rotuloPrimario={credencialCopiada ? "Copiado ✓" : "Copiar"}
        acaoPrimaria={copiarCredencial}
      >
        {credencial && (
          <div className="space-y-3 font-mono text-sm">
            <div className="rounded border border-line bg-surface-sunken p-3">
              <span className="text-ink-muted text-xs uppercase tracking-wider block font-sans">
                E-mail
              </span>
              <div className="select-all text-ink mt-0.5 font-bold">{credencial.email}</div>
            </div>
            <div className="rounded border border-seal/30 bg-seal/5 p-3">
              <span className="text-ink-muted text-xs uppercase tracking-wider block font-sans">
                Senha temporária
              </span>
              <div className="select-all text-seal font-bold text-base mt-0.5 break-all">
                {credencial.senha}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
