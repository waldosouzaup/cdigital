"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Marca } from "@/components/marca";
import { Alerta } from "@/components/alerta";

export function VerificacaoConteudo() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [reenviado, setReenviado] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  async function handleReenviar() {
    if (!email) return;
    setReenviando(true);
    try {
      const supabase = createClient();
      await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
    } catch {
      // Ignora erro de rede em reenvio
    } finally {
      setReenviando(false);
      setReenviado(true);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0d1728] p-8 sm:p-10 shadow-2xl">
      <div className="mb-6 text-center">
        <div className="inline-flex justify-center mb-5">
          <Marca subtitulo="" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Confira seu e-mail</h1>
        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          {email ? (
            <>
              Enviamos o link de acesso para{" "}
              <strong className="text-white font-medium">{email}</strong>. Clique no link para
              entrar no sistema.
            </>
          ) : (
            "Enviamos um link de acesso para o seu endereço de e-mail. Abra o link para entrar no sistema."
          )}
        </p>
      </div>

      <div className="space-y-4 pt-2">
        {reenviado && (
          <Alerta tom="sucesso" titulo="Link reenviado">
            Um novo link de acesso foi enviado para o seu e-mail.
          </Alerta>
        )}

        <button
          type="button"
          onClick={handleReenviar}
          disabled={reenviando || reenviado}
          className="w-full rounded-lg border border-slate-700 bg-slate-900/90 py-2.5 text-xs font-semibold text-slate-300 hover:border-brand-yellow/50 hover:text-white transition disabled:opacity-50 cursor-pointer"
        >
          {reenviando
            ? "Reenviando mensagem…"
            : reenviado
              ? "Link reenviado com sucesso"
              : "Não recebeu? Clique para reenviar"}
        </button>

        <div className="pt-3 text-center text-xs text-slate-400">
          <Link href="/login" className="hover:text-brand-yellow hover:underline transition">
            ← Usar outro e-mail
          </Link>
        </div>
      </div>
    </div>
  );
}

