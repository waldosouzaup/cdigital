import { defineConfig } from "drizzle-kit";

// `out` aponta para supabase/migrations (Seção 4) para que as migrations do Drizzle
// e as do Supabase CLI vivam no mesmo lugar e sejam aplicadas na mesma ordem.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./supabase/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
