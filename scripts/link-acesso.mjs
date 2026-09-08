// Gera um link de acesso (login sem e-mail) para um usuário já provisionado.
// Útil para testar papéis rápido, sem depender do e-mail chegar.
//
//   npx tsx --env-file=.env.local scripts/link-acesso.mjs <email> [redirect]
//
// Abra a URL impressa no navegador com o `npm run dev` rodando. Ela passa pelo
// /auth/callback e te encaminha (gestor/coord_comite -> /mfa; demais -> /dashboard).
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
const redirect = process.argv[3] || "http://localhost:3000/auth/callback";
if (!email) {
  console.error("uso: link-acesso.mjs <email> [redirect]");
  process.exit(1);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data, error } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email,
  options: { redirectTo: redirect },
});

if (error || !data?.properties?.action_link) {
  console.error("falhou:", error?.message ?? "sem link (o usuário existe em auth.users?)");
  process.exit(1);
}

console.log(data.properties.action_link);
