/**
 * Provisiona um usuário real (Supabase Auth + linha em public.usuarios) — uso
 * administrativo, via linha de comando (bootstrap do 1º gestor; o resto é feito
 * pela tela `/equipe`).
 *
 * Uso: tsx src/db/provision-user.ts <email> <papel> [nome] [regiao]
 *   papel: gestor | coord_comite | coord_regiao | contratado | auditor
 *   regiao: nome da região (obrigatório só para coord_regiao)
 *
 * Login é por e-mail + senha. Este script cria/redefine a senha para uma
 * TEMPORÁRIA e a imprime; o usuário é obrigado a trocá-la no primeiro acesso.
 *
 * service_role é permitida aqui (Seção 3.1: uso administrativo direto, fora do
 * caminho de requisição de usuário) — nunca rode isto a partir de uma rota que
 * atende sessão de usuário.
 */
import { createClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { db } from "./client";
import { organizations, regions, users, type userRoleEnum } from "./schema";
import { eq } from "drizzle-orm";
import { gerarSenhaTemporaria } from "@/lib/auth/senha-temporaria";

type Papel = (typeof userRoleEnum.enumValues)[number];
const PAPEIS_VALIDOS: Papel[] = ["gestor", "coord_comite", "coord_regiao", "contratado", "auditor"];

async function main() {
  const [email, papel, nome, nomeRegiao] = process.argv.slice(2);

  if (!email || !papel) {
    console.error("Uso: tsx src/db/provision-user.ts <email> <papel> [nome] [regiao]");
    console.error(`Papéis válidos: ${PAPEIS_VALIDOS.join(", ")}`);
    process.exit(1);
  }

  if (!PAPEIS_VALIDOS.includes(papel as Papel)) {
    console.error(`Papel inválido: "${papel}". Use um de: ${PAPEIS_VALIDOS.join(", ")}`);
    process.exit(1);
  }

  if (papel === "coord_regiao" && !nomeRegiao) {
    console.error('Papel "coord_regiao" exige o nome da região como 4º argumento.');
    process.exit(1);
  }

  // Única organização real até aqui (Seção 11) — Fase 2 decide como escolher entre
  // múltiplas organizações quando isso existir.
  const [organizacao] = await db.select().from(organizations).limit(1);
  if (!organizacao) {
    console.error("Nenhuma organização encontrada. Rode `npm run db:seed` primeiro.");
    process.exit(1);
  }

  let regiaoId: string | null = null;
  if (nomeRegiao) {
    const [regiao] = await db.select().from(regions).where(eq(regions.name, nomeRegiao)).limit(1);
    if (!regiao) {
      console.error(`Região "${nomeRegiao}" não encontrada em "${organizacao.name}".`);
      process.exit(1);
    }
    regiaoId = regiao.id;
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Login por e-mail + senha. A senha nasce temporária e o usuário é obrigado a
  // trocá-la no primeiro acesso (flag em app_metadata, lida pelo middleware).
  const senhaTemporaria = gerarSenhaTemporaria();
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password: senhaTemporaria,
    email_confirm: true,
    app_metadata: { must_change_password: true },
  });

  let userId: string;
  if (authError || !authUser.user) {
    // Já existe — recupera o id e redefine a senha para uma nova temporária.
    const [existente] = await db.execute<{ id: string }>(
      sql`select id from auth.users where email = ${email} limit 1`,
    );
    if (!existente) {
      console.error(`Falha ao criar usuário de autenticação: ${authError?.message}`);
      process.exit(1);
    }
    userId = existente.id;
    await admin.auth.admin.updateUserById(userId, {
      password: senhaTemporaria,
      app_metadata: { must_change_password: true },
    });
    console.log(`Usuário de autenticação já existia para ${email} — senha redefinida.`);
  } else {
    userId = authUser.user.id;
  }

  await db
    .insert(users)
    .values({
      id: userId,
      organizationId: organizacao.id,
      name: nome ?? email,
      email,
      role: papel as Papel,
      regionId: regiaoId,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { organizationId: organizacao.id, role: papel as Papel, regionId: regiaoId },
    });

  console.log(
    `\nUsuário provisionado: ${email} — papel "${papel}" em "${organizacao.name}"${nomeRegiao ? ` (região ${nomeRegiao})` : ""}.`,
  );
  console.log("─".repeat(60));
  console.log(`  E-mail...............: ${email}`);
  console.log(`  Senha temporária....: ${senhaTemporaria}`);
  console.log("─".repeat(60));
  console.log(
    "Entregue a senha por um canal seguro. No 1º login o sistema obriga a troca.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((erro) => {
    console.error("Falha ao provisionar usuário:", erro);
    process.exit(1);
  });
