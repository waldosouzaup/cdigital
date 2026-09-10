/**
 * Gestão de Acessos (Feature A) — convite, edição, exclusão com auditoria,
 * (des)ativação e redefinição de senha de membros.
 *
 * Esta rota é o ÚNICO ponto do código que chama `auth.admin.*` para usuários da equipe.
 * Fica em `src/app/api/**` de propósito: o ESLint proíbe importar `@/lib/supabase/admin`
 * sob `src/app/(painel)/**`.
 *
 * Regras de segurança (Seção 3.1):
 *   - monta PRIMEIRO o cliente SSR (RLS do chamador), lê `getClaims()` e recusa
 *     com 403 quem não for `gestor` ou `superadmin`;
 *   - `organizacao_id` vem SEMPRE das claims do chamador, nunca do corpo;
 *   - só depois disso o `criarClienteAdmin()` (service_role) é construído.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { validarEntradaUsuario } from "@/lib/equipe/validacao";
import { gerarSenhaTemporaria } from "@/lib/auth/senha-temporaria";
import { sendNotification } from "@/lib/notificacoes/enviar";
import { transporteEmailPadrao } from "@/lib/notificacoes/transporte-padrao";
import { idempotencyKey } from "@/lib/notificacoes/chave-idempotencia";
import { renderizarEmailConviteUsuario } from "@/emails/convite-usuario";

// Espelha o enum `papel_usuario` do schema
const PAPEIS_BASE = ["gestor", "coord_comite", "coord_regiao", "contratado", "auditor"] as const;
const PAPEIS_SUPERADMIN = ["superadmin", ...PAPEIS_BASE] as const;
const BAN_LONGO = "876000h"; // ~100 anos — revogação imediata do token vigente

function podeGerenciarAcessos(papel: string | undefined): boolean {
  return papel === "gestor" || papel === "superadmin";
}

async function contextoGestor() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  const userId = (claims?.sub as string | undefined) ?? null;
  const userEmail = (claims?.email as string | undefined) ?? "";

  let userName = "Gestor";
  if (userId) {
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("nome")
      .eq("id", userId)
      .maybeSingle();
    if (usuario?.nome) {
      userName = usuario.nome;
    }
  }

  return {
    supabase,
    organizationId: claims?.organizacao_id as string | undefined,
    papel: claims?.papel as string | undefined,
    userId,
    userEmail,
    userName,
  };
}

export async function POST(request: NextRequest) {
  const { supabase, organizationId, papel } = await contextoGestor();
  if (!organizationId) {
    return Response.json({ ok: false, erro: "Sessão inválida — faça login de novo." }, { status: 401 });
  }
  if (!podeGerenciarAcessos(papel)) {
    return Response.json({ ok: false, erro: "Só o gestor ou superadministrador gerencia acessos." }, { status: 403 });
  }

  let corpo: { nome?: string; email?: string; papel?: string; regiaoId?: string };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ ok: false, erro: "Requisição inválida." }, { status: 400 });
  }

  const { data: regioes } = await supabase.from("regioes").select("id");
  const regioesIds = (regioes ?? []).map((r) => r.id as string);
  const papeisValidos = papel === "superadmin" ? PAPEIS_SUPERADMIN : PAPEIS_BASE;

  const validacao = validarEntradaUsuario(
    {
      nome: corpo.nome ?? "",
      email: corpo.email ?? "",
      papel: corpo.papel ?? "",
      regiaoId: corpo.regiaoId ?? "",
    },
    { papeisValidos, regioesIds },
  );
  if (!validacao.ok) {
    return Response.json({ ok: false, erros: validacao.erros }, { status: 422 });
  }
  const { nome, email, papel: papelNovo, regiaoId } = validacao.valores;

  const admin = criarClienteAdmin();
  const senhaTemporaria = gerarSenhaTemporaria();

  const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
    email,
    password: senhaTemporaria,
    email_confirm: true,
    app_metadata: { must_change_password: true },
  });

  let userId: string;
  if (erroCriar || !criado?.user) {
    // Já existe um usuário de autenticação com este e-mail — recupera o id e
    // redefine a senha para a nova temporária.
    const { data: link, error: erroLink } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (erroLink || !link?.user) {
      return Response.json(
        { ok: false, erro: "Não foi possível criar o acesso. Verifique o e-mail." },
        { status: 502 },
      );
    }
    userId = link.user.id;
    await admin.auth.admin.updateUserById(userId, {
      password: senhaTemporaria,
      app_metadata: { must_change_password: true },
    });
  } else {
    userId = criado.user.id;
  }

  const { error: erroUpsert } = await admin
    .from("usuarios")
    .upsert(
      {
        id: userId,
        organizacao_id: organizationId,
        nome,
        email,
        papel: papelNovo,
        regiao_id: regiaoId,
        ativo: true,
      },
      { onConflict: "id" },
    );

  if (erroUpsert) {
    const jaExiste = (erroUpsert as { code?: string }).code === "23505";
    return Response.json(
      {
        ok: false,
        erro: jaExiste
          ? "Já existe um membro com este e-mail nesta organização."
          : "Não foi possível salvar o membro.",
      },
      { status: jaExiste ? 409 : 500 },
    );
  }

  // Dispara e-mail personalizado com credenciais e aviso de troca obrigatória imediata
  let emailEnviado = false;
  try {
    const baseUrl = process.env.APP_URL || "http://localhost:3000";
    const { subject, html, text } = await renderizarEmailConviteUsuario({
      nome,
      email,
      papel: papelNovo,
      senhaTemporaria,
      urlLogin: `${baseUrl}/login`,
    });

    const resultadoEnvio = await sendNotification({
      supabase: admin,
      transport: transporteEmailPadrao(),
      organizationId,
      type: "convite_usuario",
      recipientEmail: email,
      entity: "usuarios",
      entityId: userId,
      idempotencyKey: idempotencyKey("convite_usuario", userId, Date.now().toString()),
      subject,
      html,
      text,
    });

    emailEnviado = resultadoEnvio.sent;
  } catch (errEnvio) {
    console.warn("Não foi possível despachar e-mail de convite para o usuário:", errEnvio);
  }

  return Response.json({ ok: true, senhaTemporaria, emailEnviado });
}

export async function PUT(request: NextRequest) {
  const { supabase, organizationId, papel } = await contextoGestor();
  if (!organizationId) {
    return Response.json({ ok: false, erro: "Sessão inválida — faça login de novo." }, { status: 401 });
  }
  if (!podeGerenciarAcessos(papel)) {
    return Response.json({ ok: false, erro: "Só o gestor ou superadministrador gerencia acessos." }, { status: 403 });
  }

  let corpo: { id?: string; nome?: string; email?: string; papel?: string; regiaoId?: string };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ ok: false, erro: "Requisição inválida." }, { status: 400 });
  }
  if (!corpo.id) {
    return Response.json({ ok: false, erro: "Informe o membro a editar." }, { status: 400 });
  }

  const admin = criarClienteAdmin();

  // Confirma existência na organização
  const { data: membroAtual } = await admin
    .from("usuarios")
    .select("id, email, papel")
    .eq("id", corpo.id)
    .eq("organizacao_id", organizationId)
    .maybeSingle();

  if (!membroAtual) {
    return Response.json({ ok: false, erro: "Membro não encontrado nesta organização." }, { status: 404 });
  }

  const { data: regioes } = await supabase.from("regioes").select("id");
  const regioesIds = (regioes ?? []).map((r) => r.id as string);
  const papeisValidos = papel === "superadmin" ? PAPEIS_SUPERADMIN : PAPEIS_BASE;

  const validacao = validarEntradaUsuario(
    {
      nome: corpo.nome ?? "",
      email: corpo.email ?? "",
      papel: corpo.papel ?? "",
      regiaoId: corpo.regiaoId ?? "",
    },
    { papeisValidos, regioesIds },
  );
  if (!validacao.ok) {
    return Response.json({ ok: false, erros: validacao.erros }, { status: 422 });
  }
  const { nome, email, papel: papelNovo, regiaoId } = validacao.valores;

  // Se o e-mail foi alterado, atualiza também no Supabase Auth
  if (email.toLowerCase() !== membroAtual.email.toLowerCase()) {
    const { error: erroAuth } = await admin.auth.admin.updateUserById(corpo.id, {
      email,
      email_confirm: true,
    });
    if (erroAuth) {
      return Response.json(
        { ok: false, erro: `Não foi possível atualizar o e-mail na autenticação: ${erroAuth.message}` },
        { status: 400 },
      );
    }
  }

  const { error: erroUpdate } = await admin
    .from("usuarios")
    .update({
      nome,
      email,
      papel: papelNovo,
      regiao_id: regiaoId,
    })
    .eq("id", corpo.id)
    .eq("organizacao_id", organizationId);

  if (erroUpdate) {
    const jaExiste = (erroUpdate as { code?: string }).code === "23505";
    return Response.json(
      {
        ok: false,
        erro: jaExiste
          ? "Já existe um membro com este e-mail nesta organização."
          : "Não foi possível atualizar o membro.",
      },
      { status: jaExiste ? 409 : 500 },
    );
  }

  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { organizationId, papel, userId, userEmail, userName } = await contextoGestor();
  if (!organizationId) {
    return Response.json({ ok: false, erro: "Sessão inválida — faça login de novo." }, { status: 401 });
  }
  if (!podeGerenciarAcessos(papel)) {
    return Response.json({ ok: false, erro: "Só o gestor ou superadministrador gerencia acessos." }, { status: 403 });
  }

  let corpo: { id?: string; motivo?: string } = {};
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get("id");

  try {
    corpo = await request.json();
  } catch {
    // corpo não é JSON; tenta ler do parâmetro de URL
  }

  const id = corpo.id || idParam;
  if (!id) {
    return Response.json({ ok: false, erro: "Informe o membro a excluir." }, { status: 400 });
  }

  // Trava 1: Não pode autoexcluir-se
  if (userId && id === userId) {
    return Response.json({ ok: false, erro: "Você não pode excluir seu próprio acesso." }, { status: 400 });
  }

  const admin = criarClienteAdmin();

  // Busca dados completos do membro na organização
  const { data: membro } = await admin
    .from("usuarios")
    .select("*")
    .eq("id", id)
    .eq("organizacao_id", organizationId)
    .maybeSingle();

  if (!membro) {
    return Response.json({ ok: false, erro: "Membro não encontrado nesta organização." }, { status: 404 });
  }

  // Trava 2: Não pode excluir o único gestor ativo
  if (membro.papel === "gestor") {
    const { count: gestoresAtivos } = await admin
      .from("usuarios")
      .select("id", { count: "exact", head: true })
      .eq("organizacao_id", organizationId)
      .eq("papel", "gestor")
      .eq("ativo", true);

    if ((gestoresAtivos ?? 0) <= 1) {
      return Response.json(
        { ok: false, erro: "Não é possível excluir o único gestor ativo da organização." },
        { status: 400 },
      );
    }
  }

  // Trava 3: Arquivar snapshot na tabela DadosExcluidos (dados_excluidos)
  const { error: erroAudit } = await admin.from("dados_excluidos").insert({
    organizacao_id: organizationId,
    tipo_registro: "membro",
    registro_id: membro.id,
    dados: membro,
    usuario_id: userId,
    usuario_nome: userName,
    usuario_login: userEmail,
    motivo: corpo.motivo?.trim() || "Exclusão de membro da equipe pelo painel administrativo",
  });

  if (erroAudit) {
    console.error("Erro ao registrar exclusão em dados_excluidos:", erroAudit);
    return Response.json(
      { ok: false, erro: "Não foi possível registrar o arquivamento de auditoria antes da exclusão." },
      { status: 500 },
    );
  }

  // Exclui da tabela usuarios
  const { error: erroDelete } = await admin
    .from("usuarios")
    .delete()
    .eq("id", id)
    .eq("organizacao_id", organizationId);

  if (erroDelete) {
    return Response.json(
      { ok: false, erro: `Não foi possível excluir o membro da base: ${erroDelete.message}` },
      { status: 500 },
    );
  }

  // Exclui do Supabase Auth
  const { error: erroAuth } = await admin.auth.admin.deleteUser(id);
  if (erroAuth) {
    console.warn("Membro excluído da tabela usuarios, mas falha ao remover do auth:", erroAuth.message);
  }

  return Response.json({
    ok: true,
    mensagem: "Membro excluído do painel e arquivado com sucesso em DadosExcluidos.",
  });
}

export async function PATCH(request: NextRequest) {
  const { organizationId, papel } = await contextoGestor();
  if (!organizationId) {
    return Response.json({ ok: false, erro: "Sessão inválida — faça login de novo." }, { status: 401 });
  }
  if (!podeGerenciarAcessos(papel)) {
    return Response.json({ ok: false, erro: "Só o gestor ou superadministrador gerencia acessos." }, { status: 403 });
  }

  let corpo: { id?: string; ativo?: boolean; acao?: string };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ ok: false, erro: "Requisição inválida." }, { status: 400 });
  }
  if (!corpo.id) {
    return Response.json({ ok: false, erro: "Informe o membro." }, { status: 400 });
  }

  const admin = criarClienteAdmin();

  const { data: membro } = await admin
    .from("usuarios")
    .select("id, nome, email, papel")
    .eq("id", corpo.id)
    .eq("organizacao_id", organizationId)
    .maybeSingle();
  if (!membro) {
    return Response.json({ ok: false, erro: "Membro não encontrado nesta organização." }, { status: 404 });
  }

  // --- Redefinir senha ---
  if (corpo.acao === "redefinir-senha") {
    const senhaTemporaria = gerarSenhaTemporaria();
    const { error } = await admin.auth.admin.updateUserById(corpo.id, {
      password: senhaTemporaria,
      app_metadata: { must_change_password: true },
    });
    if (error) {
      return Response.json({ ok: false, erro: "Não foi possível redefinir a senha." }, { status: 500 });
    }

    let emailEnviado = false;
    try {
      const baseUrl = process.env.APP_URL || "http://localhost:3000";
      const { subject, html, text } = await renderizarEmailConviteUsuario({
        nome: membro.nome,
        email: membro.email,
        papel: membro.papel,
        senhaTemporaria,
        urlLogin: `${baseUrl}/login`,
      });

      const resultadoEnvio = await sendNotification({
        supabase: admin,
        transport: transporteEmailPadrao(),
        organizationId,
        type: "convite_usuario",
        recipientEmail: membro.email,
        entity: "usuarios",
        entityId: membro.id,
        idempotencyKey: idempotencyKey("convite_usuario", membro.id, Date.now().toString()),
        subject,
        html,
        text,
      });

      emailEnviado = resultadoEnvio.sent;
    } catch (errEnvio) {
      console.warn("Não foi possível despachar e-mail de redefinição de senha:", errEnvio);
    }

    return Response.json({ ok: true, senhaTemporaria, emailEnviado });
  }

  // --- (Des)ativar acesso ---
  if (typeof corpo.ativo === "boolean") {
    const { error: erroLinha } = await admin
      .from("usuarios")
      .update({ ativo: corpo.ativo })
      .eq("id", corpo.id)
      .eq("organizacao_id", organizationId);
    if (erroLinha) {
      return Response.json({ ok: false, erro: "Não foi possível atualizar o acesso." }, { status: 500 });
    }
    await admin.auth.admin.updateUserById(corpo.id, {
      ban_duration: corpo.ativo ? "none" : BAN_LONGO,
    });
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, erro: "Nada a fazer — informe `ativo` ou `acao`." }, { status: 400 });
}
