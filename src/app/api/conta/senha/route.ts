/**
 * Troca de senha do próprio usuário logado — usada pela página `/definir-senha`
 * (troca obrigatória no 1º acesso) e por qualquer troca voluntária futura.
 *
 * `updateUser({ password })` roda com o cliente SSR do próprio usuário (RLS/sessão
 * dele). A flag `app_metadata.must_change_password` só o admin limpa, então o
 * `criarClienteAdmin()` entra aqui APENAS depois de confirmada a sessão.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { validarNovaSenha } from "@/lib/auth/validacao";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims as Record<string, unknown> | undefined)?.sub as string | undefined;
  if (!userId) {
    return Response.json({ ok: false, erro: "Sessão inválida — faça login de novo." }, { status: 401 });
  }

  let corpo: { senha?: string; confirmacao?: string };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ ok: false, erro: "Requisição inválida." }, { status: 400 });
  }

  const validacao = validarNovaSenha(corpo.senha ?? "", corpo.confirmacao ?? "");
  if (!validacao.ok) {
    return Response.json({ ok: false, erro: validacao.erro }, { status: 422 });
  }

  const { error: erroSenha } = await supabase.auth.updateUser({ password: validacao.senha });
  if (erroSenha) {
    console.error("[conta/senha] updateUser falhou:", erroSenha);
    const msg = erroSenha.message || "";
    const amigavel = /different from the old password/i.test(msg)
      ? "A nova senha precisa ser diferente da temporária."
      : /aal2|mfa/i.test(msg)
        ? "Sua conta tem verificação em duas etapas ativa. Peça a um gestor para redefinir sua senha (Equipe & Acessos → Redefinir senha)."
        : /weak|requirements|strength|short|length/i.test(msg)
          ? "Senha fraca: use mais caracteres e misture letras e números."
          : /reauthentic/i.test(msg)
            ? "Por segurança, o Supabase está exigindo reautenticação — desative 'Secure password change' no painel (Authentication → Providers → Email)."
            : `Não foi possível trocar a senha: ${msg}`;
    return Response.json({ ok: false, erro: amigavel }, { status: 422 });
  }

  // Limpa a obrigatoriedade — só vale no próximo refresh de token (o cliente
  // chama refreshSession() logo depois).
  await criarClienteAdmin()
    .auth.admin.updateUserById(userId, { app_metadata: { must_change_password: false } })
    .catch(() => {});

  return Response.json({ ok: true });
}
