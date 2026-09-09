/**
 * Gestão de Acessos (Feature A) — convite, (des)ativação e redefinição de senha
 * de membros.
 *
 * Esta rota é o ÚNICO ponto do código que chama `auth.admin.createUser`. Fica em
 * `src/app/api/**` de propósito: o ESLint proíbe importar `@/lib/supabase/admin`
 * sob `src/app/(painel)/**`, então a Server Action do painel não pode criar o
 * usuário de autenticação — ela delega para cá via `fetch` (o cookie de sessão
 * acompanha a requisição).
 *
 * Regras de segurança (Seção 3.1):
 *   - monta PRIMEIRO o cliente SSR (RLS do chamador), lê `getClaims()` e recusa
 *     com 403 quem não for `gestor`;
 *   - `organizacao_id` vem SEMPRE das claims do chamador, nunca do corpo;
 *   - só depois disso o `criarClienteAdmin()` (service_role) é construído.
 *
 * Login é por e-mail + senha: todo membro nasce com uma senha TEMPORÁRIA
 * (devolvida uma única vez) e a flag `app_metadata.must_change_password`, que o
 * middleware usa para forçar a troca no primeiro acesso.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { validarEntradaUsuario } from "@/lib/equipe/validacao";
import { gerarSenhaTemporaria } from "@/lib/auth/senha-temporaria";

// Espelha o enum `papel_usuario` do schema (migration 0000). Hardcoded como em
// `src/db/provision-user.ts` para não puxar o módulo do schema para o bundle da rota.
const PAPEIS_VALIDOS = ["gestor", "coord_comite", "coord_regiao", "contratado", "auditor"] as const;
const BAN_LONGO = "876000h"; // ~100 anos — revogação imediata do token vigente

async function contextoGestor() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  return {
    supabase,
    organizationId: claims?.organizacao_id as string | undefined,
    papel: claims?.papel as string | undefined,
  };
}

export async function POST(request: NextRequest) {
  const { supabase, organizationId, papel } = await contextoGestor();
  if (!organizationId) {
    return Response.json({ ok: false, erro: "Sessão inválida — faça login de novo." }, { status: 401 });
  }
  if (papel !== "gestor") {
    return Response.json({ ok: false, erro: "Só o gestor gerencia acessos." }, { status: 403 });
  }

  let corpo: { nome?: string; email?: string; papel?: string; regiaoId?: string };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ ok: false, erro: "Requisição inválida." }, { status: 400 });
  }

  const { data: regioes } = await supabase.from("regioes").select("id");
  const regioesIds = (regioes ?? []).map((r) => r.id as string);

  const validacao = validarEntradaUsuario(
    {
      nome: corpo.nome ?? "",
      email: corpo.email ?? "",
      papel: corpo.papel ?? "",
      regiaoId: corpo.regiaoId ?? "",
    },
    { papeisValidos: PAPEIS_VALIDOS, regioesIds },
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
    // redefine a senha para a nova temporária. `generateLink` devolve o usuário
    // existente sem enviar e-mail (API admin).
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

  return Response.json({ ok: true, senhaTemporaria });
}

export async function PATCH(request: NextRequest) {
  const { organizationId, papel } = await contextoGestor();
  if (!organizationId) {
    return Response.json({ ok: false, erro: "Sessão inválida — faça login de novo." }, { status: 401 });
  }
  if (papel !== "gestor") {
    return Response.json({ ok: false, erro: "Só o gestor gerencia acessos." }, { status: 403 });
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

  // Confirma que o membro pertence à organização do gestor antes de qualquer
  // operação admin (que ignora RLS).
  const { data: membro } = await admin
    .from("usuarios")
    .select("id")
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
    return Response.json({ ok: true, senhaTemporaria });
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
    // Revogação imediata do token em circulação (sem isso, cai só no próximo refresh).
    await admin.auth.admin.updateUserById(corpo.id, {
      ban_duration: corpo.ativo ? "none" : BAN_LONGO,
    });
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, erro: "Nada a fazer — informe `ativo` ou `acao`." }, { status: 400 });
}
