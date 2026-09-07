/**
 * Cliente Drizzle apontando direto para o Postgres via `DATABASE_URL` — Seção 3.1:
 * "service_role só é permitida em: seed, migrations, jobs do pg_cron e webhooks."
 *
 * Esta conexão ignora RLS (é uma conexão de superusuário/service, não passa pelo
 * PostgREST nem carrega JWT algum) — por isso só pode ser usada em `src/db/seed.ts`,
 * `src/db/seed-carga.ts` e em Edge Functions/rotas de pg_cron. Nunca em Server Action
 * ou Route Handler que atende usuário: essas usam src/lib/supabase/server.ts, que
 * respeita RLS. A regra de ESLint abaixo bloqueia o import errado, igual a admin.ts.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL é obrigatória para o cliente Drizzle de seed/cron.");
}

const client = postgres(connectionString);

export const db = drizzle({ client, schema });
