import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
  // Regra de segurança da Seção 3.1 do PROMPT: a `service_role` bypassa RLS por
  // completo, então `src/lib/supabase/admin.ts` (o único lugar autorizado a usá-la)
  // NUNCA pode ser importado por uma rota que atende requisição de usuário — ou seja,
  // nada dentro de `src/app/(painel)/**`. Violar isso reintroduz o vazamento
  // multi-tenant silencioso que a Seção 3.1 descreve.
  {
    files: ["src/app/(painel)/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/supabase/admin", "**/supabase/admin.ts", "@/lib/supabase/admin"],
              message:
                "Proibido: src/lib/supabase/admin.ts usa a service_role key e ignora " +
                "RLS por completo (Seção 3.1). Não pode ser importado dentro de " +
                "src/app/(painel)/. Use src/lib/supabase/server.ts.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
