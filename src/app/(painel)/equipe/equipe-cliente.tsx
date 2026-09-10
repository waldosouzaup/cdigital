"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alerta } from "@/components/alerta";
import { Badge } from "@/components/badge";
import { Campo } from "@/components/campo";
import { Modal } from "@/components/modal";
import { Selo } from "@/components/selo";
import { EstadoVazio } from "@/components/estado-vazio";
import { alterarPapelUsuario } from "./acoes";
import { ESTADO_INICIAL_ALTERAR_PAPEL } from "./estado";
import type { MembroEquipe } from "./dados";
import type { RegiaoOpcao } from "../pessoas/dados";

const PAPEIS: { valor: string; rotulo: string }[] = [
  { valor: "gestor", rotulo: "Gestor" },
  { valor: "coord_comite", rotulo: "Coordenador de Comitê" },
  { valor: "coord_regiao", rotulo: "Coordenador Regional" },
  { valor: "auditor", rotulo: "Auditor" },
  { valor: "contratado", rotulo: "Contratado" },
];

function rotuloPapel(valor: string): string {
  return PAPEIS.find((p) => p.valor === valor)?.rotulo ?? valor;
}

export function EquipeCliente({
  membrosIniciais,
  regioes,
}: {
  membrosIniciais: MembroEquipe[];
  regioes: RegiaoOpcao[];
}) {
  const router = useRouter();

  // Senha temporária devolvida por convite ou redefinição — exibida UMA única vez
  const [credencial, setCredencial] = useState<{
    email: string;
    senha: string;
    emailEnviado?: boolean;
  } | null>(null);
  const [credencialCopiada, setCredencialCopiada] = useState(false);

  // ----- Convidar (fetch → /api/equipe/convite; não é Server Action) -----
  const [modalConvite, setModalConvite] = useState(false);
  const [conviteEnviando, iniciarConvite] = useTransition();
  const [conviteErro, setConviteErro] = useState<string | null>(null);
  const conviteFormRef = useRef<HTMLFormElement>(null);
  const [convitePapel, setConvitePapel] = useState("coord_comite");

  function enviarConvite() {
    const form = conviteFormRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const email = String(fd.get("email") ?? "");
    const corpo = {
      nome: String(fd.get("nome") ?? ""),
      email,
      papel: String(fd.get("papel") ?? ""),
      regiaoId: String(fd.get("regiaoId") ?? ""),
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
        emailEnviado?: boolean;
      };
      if (!resp.ok || !dados.ok) {
        const primeiroErro = dados.erros ? Object.values(dados.erros)[0] : undefined;
        setConviteErro(dados.erro ?? primeiroErro ?? "Não foi possível enviar o convite.");
        return;
      }
      setModalConvite(false);
      form.reset();
      setConvitePapel("coord_comite");
      if (dados.senhaTemporaria) {
        setCredencial({
          email,
          senha: dados.senhaTemporaria,
          emailEnviado: dados.emailEnviado,
        });
      }
      router.refresh();
    });
  }

  // ----- Redefinir senha (fetch PATCH) -----
  const [redefinindoId, setRedefinindoId] = useState<string | null>(null);

  async function redefinirSenha(membro: MembroEquipe) {
    setRedefinindoId(membro.id);
    const resp = await fetch("/api/equipe/convite", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: membro.id, acao: "redefinir-senha" }),
    });
    const dados = (await resp.json().catch(() => ({}))) as {
      ok?: boolean;
      senhaTemporaria?: string;
      emailEnviado?: boolean;
    };
    setRedefinindoId(null);
    if (resp.ok && dados.ok && dados.senhaTemporaria) {
      setCredencial({
        email: membro.email,
        senha: dados.senhaTemporaria,
        emailEnviado: dados.emailEnviado,
      });
    }
  }

  async function copiarCredencial() {
    if (!credencial) return;
    await navigator.clipboard.writeText(`${credencial.email} / ${credencial.senha}`);
    setCredencialCopiada(true);
    setTimeout(() => setCredencialCopiada(false), 2000);
  }

  // ----- Alterar papel/região (Server Action) -----
  const [membroEditando, setMembroEditando] = useState<MembroEquipe | null>(null);
  const [estadoAlterar, alterarAction, alterando] = useActionState(
    alterarPapelUsuario,
    ESTADO_INICIAL_ALTERAR_PAPEL,
  );
  const alterarFormRef = useRef<HTMLFormElement>(null);
  const [alterarPapelSel, setAlterarPapelSel] = useState("");

  useEffect(() => {
    if (estadoAlterar.status === "sucesso") {
      setMembroEditando(null);
      router.refresh();
    }
  }, [estadoAlterar.status, router]);

  // ----- (Des)ativar (fetch PATCH → também revoga o token vigente) -----
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
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="regua flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-h1 font-semibold text-ink">Equipe &amp; Acessos</h1>
          <p className="mt-1 text-small text-ink-muted">
            O gestor cadastra e administra os usuários de todos os papéis, atribui região,
            desativa acesso e redefine senhas. O login é por e-mail e senha.
          </p>
        </div>
        <Selo voz="selo" onClick={() => setModalConvite(true)} className="shrink-0 text-xs">
          + Convidar membro
        </Selo>
      </header>

      <Alerta tom="informativo">
        Convidar ou redefinir a senha gera uma <strong>senha temporária</strong>, mostrada uma
        única vez — entregue por um canal seguro; no primeiro login o membro é obrigado a
        trocá-la. Mudança de papel/região vale no próximo login do membro; desativar derruba a
        sessão em circulação.
      </Alerta>

      {membrosIniciais.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum membro cadastrado"
          descricao="Convide o primeiro coordenador no botão acima."
        />
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[40rem] text-small">
            <thead className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-muted">
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
                <tr key={m.id} className={m.ativo ? "" : "opacity-60"}>
                  <td className="p-3">
                    <span className="block font-medium text-ink">{m.nome}</span>
                    <span className="block font-mono text-xs text-ink-muted">{m.email}</span>
                  </td>
                  <td className="p-3">
                    <Badge status="neutro" rotuloPersonalizado={rotuloPapel(m.papel)} />
                  </td>
                  <td className="p-3 text-ink-muted">{m.regiaoNome ?? "—"}</td>
                  <td className="p-3">
                    <Badge
                      status={m.ativo ? "apta" : "cancelado"}
                      rotuloPersonalizado={m.ativo ? "Ativo" : "Desativado"}
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setMembroEditando(m);
                          setAlterarPapelSel(m.papel);
                        }}
                        className="text-xs font-medium text-seal underline decoration-seal/40 underline-offset-4"
                      >
                        Alterar acesso
                      </button>
                      <button
                        type="button"
                        onClick={() => redefinirSenha(m)}
                        disabled={redefinindoId === m.id}
                        className="text-xs font-medium text-ink-muted underline decoration-line underline-offset-4 hover:text-ink disabled:opacity-50"
                      >
                        {redefinindoId === m.id ? "…" : "Redefinir senha"}
                      </button>
                      <button
                        type="button"
                        onClick={() => alternarAtivo(m)}
                        disabled={alternandoId === m.id}
                        className="text-xs font-medium text-ink-muted underline decoration-line underline-offset-4 hover:text-ink disabled:opacity-50"
                      >
                        {alternandoId === m.id ? "…" : m.ativo ? "Desativar" : "Reativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL — Senha temporária (convite ou redefinição) */}
      <Modal
        aberto={credencial !== null}
        aoFechar={() => setCredencial(null)}
        titulo="Senha temporária gerada"
        descricao="Anote agora — não será exibida novamente no painel. Uma mensagem com esta senha e as orientações de primeiro acesso também foi enviada para o e-mail cadastrado."
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

            <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 font-sans text-xs text-amber-800 dark:text-amber-200">
              <span className="font-semibold block mb-0.5">⚠️ Troca obrigatória no primeiro login</span>
              O colaborador foi notificado por e-mail e deverá alterar esta senha provisória imediatamente no primeiro acesso ao sistema.
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL — Convidar */}
      <Modal
        aberto={modalConvite}
        aoFechar={() => setModalConvite(false)}
        titulo="Convidar membro"
        descricao="Cria o acesso com uma senha temporária, que aparece na próxima tela."
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
            {PAPEIS.map((p) => (
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

      {/* MODAL — Alterar acesso */}
      <Modal
        aberto={membroEditando !== null}
        aoFechar={() => setMembroEditando(null)}
        titulo={membroEditando ? `Alterar acesso — ${membroEditando.nome}` : "Alterar acesso"}
        rotuloPrimario={alterando ? "Salvando…" : "Salvar"}
        acaoPrimaria={() => alterarFormRef.current?.requestSubmit()}
        desabilitarConfirmacao={alterando}
      >
        <form ref={alterarFormRef} action={alterarAction} className="space-y-4">
          <input type="hidden" name="id" value={membroEditando?.id ?? ""} />
          {estadoAlterar.status === "erro" && estadoAlterar.mensagem && (
            <Alerta tom="critico">{estadoAlterar.mensagem}</Alerta>
          )}
          <Campo.Selecao
            rotulo="Papel"
            id="alterar-papel"
            name="papel"
            value={alterarPapelSel}
            onChange={(e) => setAlterarPapelSel(e.target.value)}
            erro={estadoAlterar.status === "erro" ? estadoAlterar.erros?.papel : undefined}
          >
            {PAPEIS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </Campo.Selecao>
          {alterarPapelSel === "coord_regiao" && (
            <Campo.Selecao
              rotulo="Região de atuação"
              id="alterar-regiao"
              name="regiaoId"
              defaultValue={membroEditando?.regiaoId ?? ""}
              erro={estadoAlterar.status === "erro" ? estadoAlterar.erros?.regiaoId : undefined}
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
        </form>
      </Modal>
    </div>
  );
}
