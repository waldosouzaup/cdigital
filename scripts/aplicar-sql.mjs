// Aplica uma migration .sql contra o Postgres do Supabase hospedado, dividindo por
// "--> statement-breakpoint" e rodando tudo dentro de uma transação.
//
// Existe porque `drizzle-kit migrate` trava indefinidamente contra o pooler do
// Supabase hospedado (registrado em CONSULTAS.md/PROGRESSO desde a Fase 1). Mesmo
// contorno já usado para aplicar as migrations 0003–0011.
//
//   npx tsx --env-file=.env.local scripts/aplicar-sql.mjs supabase/migrations/NNNN_nome.sql
import { readFileSync } from "node:fs";
import postgres from "postgres";

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("uso: aplicar-sql.mjs <caminho.sql>");
  process.exit(1);
}

const statements = readFileSync(arquivo, "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

const sql = postgres(process.env.DATABASE_URL, { prepare: false });
try {
  await sql.begin(async (tx) => {
    for (let i = 0; i < statements.length; i++) {
      const primeiraLinha = statements[i].split("\n").find((l) => l.trim() && !l.trim().startsWith("--"));
      console.log(`  [${i + 1}/${statements.length}] ${(primeiraLinha ?? "").slice(0, 72)}`);
      await tx.unsafe(statements[i]);
    }
  });
  console.log("OK — aplicada em transação.");
} catch (e) {
  console.error("FALHOU (rollback):", e.message);
  process.exit(1);
} finally {
  await sql.end();
}
