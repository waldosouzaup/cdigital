/**
 * Migração única de credenciais: define senha (via admin — ignora o aal2) e
 * REMOVE os fatores MFA de cada usuário. Rode uma vez ao trocar o login de link
 * mágico para e-mail + senha (migration 0018).
 *
 * Por que remover o MFA: o GoTrue exige sessão `aal2` para trocar senha de quem
 * tem fator cadastrado — o que trava a tela `/definir-senha` (que roda em aal1).
 * Como o MFA virou opcional, o recomeço limpo é apagar os fatores; quem quiser
 * reativa em "Configurações → Verificação em duas etapas".
 *
 * Uso: npm run db:reset-senhas                      (todos, senha temporária + troca obrigatória)
 *      npm run db:reset-senhas -- email1@x email2@y (só esses)
 *      npm run db:reset-senhas -- email@x --senha "MinhaSenha!123"
 *          define ESSA senha e NÃO obriga a troca (desbloqueio rápido).
 *
 * service_role — uso administrativo direto, fora do caminho de requisição.
 */
import { createClient } from "@supabase/supabase-js";
import { gerarSenhaTemporaria } from "@/lib/auth/senha-temporaria";

async function main() {
  const args = process.argv.slice(2);
  const iSenha = args.indexOf("--senha");
  const senhaFixa = iSenha >= 0 ? args[iSenha + 1] : undefined;
  const filtro = args
    .filter((a, idx) => idx !== iSenha && idx !== iSenha + 1 && !a.startsWith("--"))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (senhaFixa !== undefined && (!senhaFixa || senhaFixa.length < 8)) {
    console.error("--senha exige um valor com pelo menos 8 caracteres.");
    process.exit(1);
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: usuarios, error } = await admin
    .from("usuarios")
    .select("id, email, nome, papel")
    .order("email");
  if (error) {
    console.error("Falha ao listar usuários:", error.message);
    process.exit(1);
  }

  const alvo = (usuarios ?? []).filter(
    (u) => filtro.length === 0 || filtro.includes(String(u.email).toLowerCase()),
  );
  if (alvo.length === 0) {
    console.log("Nenhum usuário para processar.");
    return;
  }

  const obrigarTroca = senhaFixa === undefined;
  const linhas: { email: string; papel: string; senha: string; mfaRemovidos: number; erro?: string }[] = [];
  for (const u of alvo) {
    const id = u.id as string;

    // Apaga os fatores MFA (via admin — não precisa de aal2).
    let mfaRemovidos = 0;
    const { data: detalhe } = await admin.auth.admin.getUserById(id);
    for (const f of detalhe?.user?.factors ?? []) {
      const { error } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: id });
      if (!error) mfaRemovidos += 1;
    }

    const senha = senhaFixa ?? gerarSenhaTemporaria();
    const { error: erroUp } = await admin.auth.admin.updateUserById(id, {
      password: senha,
      app_metadata: { must_change_password: obrigarTroca },
    });
    linhas.push({
      email: u.email as string,
      papel: u.papel as string,
      senha,
      mfaRemovidos,
      erro: erroUp?.message,
    });
  }

  console.log(
    obrigarTroca
      ? "\nSenhas temporárias — entregue por um canal seguro. No 1º login o sistema obriga a troca.\n"
      : "\nSenha definida (SEM troca obrigatória) — já pode logar direto.\n",
  );
  console.log("─".repeat(72));
  for (const l of linhas) {
    const mfa = l.mfaRemovidos > 0 ? `  (${l.mfaRemovidos} fator MFA removido)` : "";
    if (l.erro) {
      console.log(`  ${l.email.padEnd(38)}  FALHOU: ${l.erro}${mfa}`);
    } else {
      console.log(`  ${l.email.padEnd(38)}  ${l.papel.padEnd(13)}  ${l.senha}${mfa}`);
    }
  }
  console.log("─".repeat(72));
  const falhas = linhas.filter((l) => l.erro).length;
  console.log(`${linhas.length - falhas} ok, ${falhas} falha(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Falha:", e);
    process.exit(1);
  });
