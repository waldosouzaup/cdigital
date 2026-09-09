import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Reestruturação de acesso — login por e-mail + senha, com troca obrigatória no
 * primeiro acesso (flag `app_metadata.must_change_password`).
 *
 * Exercita o mecanismo que a página `/definir-senha` + o Route Handler
 * `/api/conta/senha` + o middleware usam, direto pelo cliente anon:
 *   1. usuário nasce com senha temporária + flag;
 *   2. o JWT do login carrega a flag (o middleware barra o painel);
 *   3. troca de senha + limpeza da flag (admin) + refresh -> flag some;
 *   4. a senha antiga para de funcionar; a nova funciona.
 */
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

const EMAIL = "troca-senha-teste@exemplo.invalid";
const SENHA_TEMP = "TempInicial!123456";
const SENHA_NOVA = "MinhaSenhaDefinitiva!9";

function flagDoJwt(accessToken: string): unknown {
  const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64").toString());
  return payload?.app_metadata?.must_change_password;
}

let userId: string;

beforeAll(async () => {
  const antigo = (await admin.auth.admin.listUsers()).data.users.find((u) => u.email === EMAIL);
  if (antigo) await admin.auth.admin.deleteUser(antigo.id).catch(() => {});

  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: SENHA_TEMP,
    email_confirm: true,
    app_metadata: { must_change_password: true },
  });
  if (error || !data.user) throw new Error(`Falha ao criar usuário: ${error?.message}`);
  userId = data.user.id;
}, 30000);

afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
}, 30000);

describe("troca de senha obrigatória no primeiro acesso", () => {
  it("o JWT do primeiro login carrega must_change_password = true", async () => {
    const anon = anonClient();
    const { data, error } = await anon.auth.signInWithPassword({
      email: EMAIL,
      password: SENHA_TEMP,
    });
    expect(error).toBeNull();
    expect(flagDoJwt(data.session!.access_token)).toBe(true);
  });

  it("após trocar a senha e limpar a flag, o refresh traz um JWT sem a obrigatoriedade", async () => {
    const anon = anonClient();
    await anon.auth.signInWithPassword({ email: EMAIL, password: SENHA_TEMP });

    const { error: erroTroca } = await anon.auth.updateUser({ password: SENHA_NOVA });
    expect(erroTroca).toBeNull();

    await admin.auth.admin.updateUserById(userId, {
      app_metadata: { must_change_password: false },
    });

    const { data: refresh, error: erroRefresh } = await anon.auth.refreshSession();
    expect(erroRefresh).toBeNull();
    expect(flagDoJwt(refresh.session!.access_token)).not.toBe(true);
  });

  it("a senha temporária para de funcionar; a nova funciona", async () => {
    const comTemp = await anonClient().auth.signInWithPassword({
      email: EMAIL,
      password: SENHA_TEMP,
    });
    expect(comTemp.error).not.toBeNull();

    const comNova = await anonClient().auth.signInWithPassword({
      email: EMAIL,
      password: SENHA_NOVA,
    });
    expect(comNova.error).toBeNull();
  });
});
