/**
 * API Administrativa para SuperAdmin — Criação e configuração de Campanhas
 * (Organizações) e provisionamento dos primeiros Gestores do projeto.
 *
 * Rota protegida: exclusiva para usuários com papel 'superadmin'.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { gerarSenhaTemporaria } from "@/lib/auth/senha-temporaria";

async function contextoSuperAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  return {
    supabase,
    userId: (claims?.sub as string | undefined) ?? null,
    papel: claims?.papel as string | undefined,
    organizationId: claims?.organizacao_id as string | undefined,
  };
}

export async function GET() {
  const { papel } = await contextoSuperAdmin();
  if (papel !== "superadmin") {
    return Response.json({ ok: false, erro: "Acesso restrito ao Super Administrador." }, { status: 403 });
  }

  const admin = criarClienteAdmin();
  const { data: orgs, error: erroOrgs } = await admin
    .from("organizacoes")
    .select("id, nome, cnpj, slug, ativa, criado_em")
    .order("criado_em", { ascending: false });

  if (erroOrgs) {
    return Response.json({ ok: false, erro: "Não foi possível carregar as campanhas." }, { status: 500 });
  }

  const { data: usuarios } = await admin
    .from("usuarios")
    .select("id, nome, email, papel, organizacao_id, ativo");

  const campanhas = (orgs ?? []).map((org) => {
    const membrosDaOrg = (usuarios ?? []).filter((u) => u.organizacao_id === org.id);
    const gestores = membrosDaOrg
      .filter((u) => u.papel === "gestor" && u.ativo)
      .map((u) => ({ id: u.id, nome: u.nome, email: u.email }));

    return {
      id: org.id,
      nome: org.nome,
      cnpj: org.cnpj,
      slug: org.slug,
      ativa: org.ativa ?? true,
      criadoEm: org.criado_em,
      gestores,
      totalMembros: membrosDaOrg.length,
    };
  });

  return Response.json({ ok: true, campanhas });
}

export async function POST(request: NextRequest) {
  const { papel } = await contextoSuperAdmin();
  if (papel !== "superadmin") {
    return Response.json({ ok: false, erro: "Apenas o Super Administrador pode criar novas campanhas." }, { status: 403 });
  }

  let corpo: {
    nomeCampanha?: string;
    cnpj?: string;
    slug?: string;
    gestorNome?: string;
    gestorEmail?: string;
  };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ ok: false, erro: "Requisição inválida." }, { status: 400 });
  }

  const nomeCampanha = (corpo.nomeCampanha ?? "").trim();
  if (!nomeCampanha) {
    return Response.json({ ok: false, erro: "Informe o nome da campanha / organização." }, { status: 422 });
  }

  const cnpj = (corpo.cnpj ?? "").trim() || null;
  let slug = (corpo.slug ?? "").trim().toLowerCase();
  if (!slug) {
    slug = nomeCampanha
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const admin = criarClienteAdmin();

  // Verifica se o slug já existe
  if (slug) {
    const { data: slugExistente } = await admin
      .from("organizacoes")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (slugExistente) {
      return Response.json({ ok: false, erro: `O identificador (slug) "${slug}" já está em uso.` }, { status: 409 });
    }
  }

  // Cria a organização/campanha
  const { data: novaOrg, error: erroOrg } = await admin
    .from("organizacoes")
    .insert({
      nome: nomeCampanha,
      cnpj,
      slug: slug || null,
      ativa: true,
    })
    .select()
    .single();

  if (erroOrg || !novaOrg) {
    return Response.json(
      { ok: false, erro: `Não foi possível criar a campanha: ${erroOrg?.message ?? "Erro desconhecido"}` },
      { status: 500 },
    );
  }

  // Provisiona o 1º gestor se fornecido
  let gestorCriado: { email: string; senhaTemporaria: string } | null = null;
  const gestorNome = (corpo.gestorNome ?? "").trim();
  const gestorEmail = (corpo.gestorEmail ?? "").trim().toLowerCase();

  if (gestorEmail && gestorNome) {
    const senhaTemporaria = gerarSenhaTemporaria();
    const { data: criadoAuth, error: erroAuth } = await admin.auth.admin.createUser({
      email: gestorEmail,
      password: senhaTemporaria,
      email_confirm: true,
      app_metadata: { must_change_password: true },
    });

    let userId: string;
    if (erroAuth || !criadoAuth?.user) {
      const { data: link, error: erroLink } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: gestorEmail,
      });
      if (erroLink || !link?.user) {
        return Response.json(
          {
            ok: true,
            organizacao: novaOrg,
            aviso: "Campanha criada, mas houve falha ao criar o acesso do primeiro gestor. Verifique o e-mail.",
          },
          { status: 201 },
        );
      }
      userId = link.user.id;
      await admin.auth.admin.updateUserById(userId, {
        password: senhaTemporaria,
        app_metadata: { must_change_password: true },
      });
    } else {
      userId = criadoAuth.user.id;
    }

    const { error: erroUsuario } = await admin.from("usuarios").insert({
      id: userId,
      organizacao_id: novaOrg.id,
      nome: gestorNome,
      email: gestorEmail,
      papel: "gestor",
      ativo: true,
    });

    if (!erroUsuario) {
      gestorCriado = { email: gestorEmail, senhaTemporaria };
    }
  }

  return Response.json({
    ok: true,
    organizacao: novaOrg,
    primeiroGestor: gestorCriado,
    mensagem: "Campanha criada com sucesso!",
  });
}
