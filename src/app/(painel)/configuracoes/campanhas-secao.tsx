"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alerta } from "@/components/alerta";
import { Badge } from "@/components/badge";
import { Campo } from "@/components/campo";
import { Modal } from "@/components/modal";
import { Selo } from "@/components/selo";
import { EstadoVazio } from "@/components/estado-vazio";
import type { CampanhaSuperadmin } from "./dados";

function formatarData(dataIso?: string): string {
  if (!dataIso) return "—";
  try {
    const d = new Date(dataIso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dataIso;
  }
}

export function CampanhasSecao({
  campanhasIniciais,
}: {
  campanhasIniciais: CampanhaSuperadmin[];
}) {
  const router = useRouter();

  // Modal de Nova Campanha
  const [modalNovaCampanha, setModalNovaCampanha] = useState(false);
  const [salvandoCampanha, iniciarSalvar] = useTransition();
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Estados dos campos
  const [nomeCampanha, setNomeCampanha] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [slug, setSlug] = useState("");
  const [gestorNome, setGestorNome] = useState("");
  const [gestorEmail, setGestorEmail] = useState("");

  // Credencial do 1º gestor gerada
  const [credencialGestor, setCredencialGestor] = useState<{ email: string; senha: string } | null>(null);
  const [credencialCopiada, setCredencialCopiada] = useState(false);

  // Sugestão de slug automático enquanto digita o nome
  function handleNomeChange(valor: string) {
    setNomeCampanha(valor);
    if (!slug || slug === gerarSlug(nomeCampanha)) {
      setSlug(gerarSlug(valor));
    }
  }

  function gerarSlug(texto: string): string {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function criarCampanha() {
    setErroSalvar(null);
    iniciarSalvar(async () => {
      const resp = await fetch("/api/superadmin/campanhas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeCampanha,
          cnpj,
          slug,
          gestorNome,
          gestorEmail,
        }),
      });

      const dados = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        erro?: string;
        primeiroGestor?: { email: string; senhaTemporaria: string } | null;
      };

      if (!resp.ok || !dados.ok) {
        setErroSalvar(dados.erro ?? "Não foi possível criar a campanha.");
        return;
      }

      setModalNovaCampanha(false);
      setNomeCampanha("");
      setCnpj("");
      setSlug("");
      setGestorNome("");
      setGestorEmail("");

      if (dados.primeiroGestor) {
        setCredencialGestor({
          email: dados.primeiroGestor.email,
          senha: dados.primeiroGestor.senhaTemporaria,
        });
      }

      router.refresh();
    });
  }

  async function copiarCredencial() {
    if (!credencialGestor) return;
    await navigator.clipboard.writeText(`${credencialGestor.email} / ${credencialGestor.senha}`);
    setCredencialCopiada(true);
    setTimeout(() => setCredencialCopiada(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">👑</span>
            <h2 className="text-h2 font-semibold text-ink">Campanhas &amp; Gestores do Projeto</h2>
            <Badge status="apta" rotuloPersonalizado="SuperAdmin" />
          </div>
          <p className="mt-1 text-small text-ink-muted">
            Configure novas campanhas/organizações, provisione os primeiros gestores de cada
            projeto e acompanhe as equipes ativas centralizadamente.
          </p>
        </div>
        <Selo
          voz="selo"
          onClick={() => setModalNovaCampanha(true)}
          className="shrink-0 text-xs"
        >
          + Nova Campanha &amp; Gestor
        </Selo>
      </div>

      <Alerta tom="informativo">
        Como <strong>Super Administrador</strong>, você tem visão cross-organizacional para criar
        novos comitês eleitorais, definir seus parâmetros de identidade e cadastrar os gestores
        que assumirão a condução de cada projeto.
      </Alerta>

      {campanhasIniciais.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma campanha configurada"
          descricao="Clique no botão acima para criar a primeira campanha e seu gestor."
        />
      ) : (
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="w-full min-w-[50rem] text-small">
            <thead className="border-b border-line bg-surface-sunken text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="p-3">Campanha</th>
                <th className="p-3">CNPJ</th>
                <th className="p-3">Inscrição Pública</th>
                <th className="p-3">Gestores Ativos</th>
                <th className="p-3 text-center">Membros</th>
                <th className="p-3">Criado em</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {campanhasIniciais.map((c) => (
                <tr key={c.id} className="hover:bg-surface-sunken/40">
                  <td className="p-3">
                    <span className="block font-semibold text-ink">{c.nome}</span>
                    <span className="block font-mono text-[0.7rem] text-ink-muted">{c.id}</span>
                  </td>
                  <td className="p-3 font-mono text-xs text-ink-muted">{c.cnpj ?? "—"}</td>
                  <td className="p-3">
                    {c.slug ? (
                      <span className="rounded bg-surface-sunken px-2 py-0.5 font-mono text-xs text-ink">
                        /inscricao/{c.slug}
                      </span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {c.gestores.length > 0 ? (
                      <div className="space-y-0.5">
                        {c.gestores.map((g) => (
                          <div key={g.id} className="text-xs">
                            <span className="font-medium text-ink">{g.nome}</span>
                            <span className="block font-mono text-[0.65rem] text-ink-muted">
                              {g.email}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-ink-muted italic">Nenhum gestor ativo</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <span className="rounded-full bg-surface-sunken border border-line px-2 py-0.5 font-mono text-xs font-semibold text-ink">
                      {c.totalMembros}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-ink-muted">{formatarData(c.criadoEm)}</td>
                  <td className="p-3">
                    <Badge
                      status={c.ativa ? "apta" : "cancelado"}
                      rotuloPersonalizado={c.ativa ? "Ativa" : "Inativa"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: CRIAR NOVA CAMPANHA & 1º GESTOR */}
      <Modal
        aberto={modalNovaCampanha}
        aoFechar={() => setModalNovaCampanha(false)}
        titulo="Configurar Nova Campanha"
        descricao="Cria a organização eleitoral e cadastra o primeiro gestor responsável com senha temporária."
        rotuloPrimario={salvandoCampanha ? "Criando…" : "Criar Campanha & Gestor"}
        acaoPrimaria={criarCampanha}
        desabilitarConfirmacao={salvandoCampanha}
      >
        <form ref={formRef} onSubmit={(e) => { e.preventDefault(); criarCampanha(); }} className="space-y-4">
          {erroSalvar && <Alerta tom="critico">{erroSalvar}</Alerta>}

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-seal border-b border-line pb-1">
              1. Dados da Campanha / Organização
            </h3>
            <Campo
              rotulo="Nome da Campanha"
              id="campanha-nome"
              placeholder="Ex: Comitê Central Eleitoral 2026"
              value={nomeCampanha}
              onChange={(e) => handleNomeChange(e.target.value)}
              required
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo
                rotulo="CNPJ do Comitê"
                id="campanha-cnpj"
                placeholder="00.000.000/0001-00"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
              />
              <Campo
                rotulo="Slug da URL pública"
                id="campanha-slug"
                placeholder="comite-2026"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>
            {slug && (
              <p className="text-[0.75rem] text-ink-muted">
                URL de autoinscrição:{" "}
                <strong className="font-mono text-seal">/inscricao/{slug}</strong>
              </p>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-seal border-b border-line pb-1">
              2. Primeiro Gestor do Projeto
            </h3>
            <Campo
              rotulo="Nome do Gestor"
              id="gestor-nome"
              placeholder="Nome completo do primeiro gestor"
              value={gestorNome}
              onChange={(e) => setGestorNome(e.target.value)}
            />
            <Campo
              rotulo="E-mail de Acesso"
              id="gestor-email"
              type="email"
              placeholder="gestor@campanha.com.br"
              value={gestorEmail}
              onChange={(e) => setGestorEmail(e.target.value)}
            />
            <p className="text-[0.75rem] text-ink-muted">
              Uma senha temporária segura será gerada automaticamente e exibida para entrega ao gestor.
            </p>
          </div>
        </form>
      </Modal>

      {/* MODAL: SENHA TEMPORÁRIA DO 1º GESTOR */}
      <Modal
        aberto={credencialGestor !== null}
        aoFechar={() => setCredencialGestor(null)}
        titulo="Credencial do Primeiro Gestor Gerada"
        descricao="Anote agora — entregue por canal seguro. O gestor é obrigado a trocar a senha no primeiro login."
        rotuloPrimario={credencialCopiada ? "Copiado ✓" : "Copiar Credenciais"}
        acaoPrimaria={copiarCredencial}
      >
        {credencialGestor && (
          <div className="space-y-3 font-mono text-sm">
            <div className="rounded border border-line bg-surface-sunken p-3">
              <span className="text-ink-muted text-xs uppercase tracking-wider block font-sans">
                E-mail do Gestor
              </span>
              <div className="select-all text-ink mt-0.5 font-bold">{credencialGestor.email}</div>
            </div>
            <div className="rounded border border-seal/30 bg-seal/5 p-3">
              <span className="text-ink-muted text-xs uppercase tracking-wider block font-sans">
                Senha Temporária
              </span>
              <div className="select-all text-seal font-bold text-base mt-0.5 break-all">
                {credencialGestor.senha}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
