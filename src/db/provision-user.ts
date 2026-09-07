/**
 * Provisiona um usuário real (Supabase Auth + linha em public.usuarios) — uso
 * administrativo, via linha de comando, enquanto a Fase 2 não constrói a tela de
 * gerenciamento de usuários.
 *
 * Uso: tsx src/db/provision-user.ts <email> <papel> [nome] [regiao]
 *   papel: gestor | coord_comite | coord_regiao | contratado | auditor
 *   regiao: nome da região (obrigatório só para coord_regiao)
 *
 * service_role é permitida aqui (Seção 3.1: "seed" e uso administrativo direto,
 * fora do caminho de requisição de usuário) — nunca rode isto a partir de uma rota
 * que atende sessão de usuário.
 */
import { createClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { db } from "./client";
import { organizations, regions, users, type userRoleEnum } from "./schema";
import { eq } from "drizzle-orm";

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

  // Sem senha — o login do Comitê Digital é por link mágico (Seção 3), não por senha.
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  let userId: string;
  if (authError || !authUser.user) {
    // Já existe (alguém pode ter tentado /login com este e-mail antes de ter linha
    // em usuarios) — busca o id existente em vez de falhar.
    const [existente] = await db.execute<{ id: string }>(
      sql`select id from auth.users where email = ${email} limit 1`,
    );
    if (!existente) {
      console.error(`Falha ao criar usuário de autenticação: ${authError?.message}`);
      process.exit(1);
    }
    userId = existente.id;
    console.log(`Usuário de autenticação já existia para ${email} — reaproveitando.`);
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
    `Usuário provisionado: ${email} — papel "${papel}" em "${organizacao.name}"${nomeRegiao ? ` (região ${nomeRegiao})` : ""}.`,
  );
  console.log("Login: acessar /login, digitar este e-mail, abrir o link recebido.");
  if (papel === "gestor" || papel === "coord_comite") {
    console.log(
      "MFA (TOTP) é obrigatório — a tela de login vai pedir o cadastro no primeiro acesso.",
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((erro) => {
    console.error("Falha ao provisionar usuário:", erro);
    process.exit(1);
  });
