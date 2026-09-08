"use client";

/**
 * Destino do link mágico de acesso.
 *
 * O link pode voltar de duas formas, dependendo do fluxo com que o OTP foi pedido:
 *   - PKCE:    `/auth/callback?code=...`            -> exchangeCodeForSession
 *   - implícito: `/auth/callback#access_token=...`  -> setSession
 * Tratamos as duas explicitamente (não dependemos do `detectSessionInUrl`).
 *
 * Depois encaminha por papel:
 *   gestor / coord_comite -> /mfa  (precisam de aal2 — Seção 3, item 6)
 *   demais                -> /dashboard
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PAPEIS_COM_MFA = new Set(["gestor", "coord_comite"]);

export default function AuthCallbackPage() {
  const router = useRouter();
  const [mensagem, setMensagem] = useState("Entrando…");

  useEffect(() => {
    const supabase = createClient();

    async function entrar() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const erroLink = url.searchParams.get("error") || hash.get("error");

        if (erroLink) throw new Error(erroLink);

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          // Talvez a sessão já exista (retorno de navegação).
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw new Error("sem token no retorno");
        }

        const { data } = await supabase.auth.getClaims();
        const papel = (data?.claims as Record<string, unknown> | undefined)?.papel as
          | string
          | undefined;
        router.replace(papel && PAPEIS_COM_MFA.has(papel) ? "/mfa" : "/dashboard");
      } catch {
        setMensagem("Link inválido ou expirado.");
        router.replace("/login?erro=link");
      }
    }

    void entrar();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070d18] p-6 text-slate-300">
      <div className="flex items-center gap-3 text-sm">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
        {mensagem}
      </div>
    </main>
  );
}
