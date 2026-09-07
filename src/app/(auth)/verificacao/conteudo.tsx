"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function VerificacaoConteudo() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [reenviado, setReenviado] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  async function handleReenviar() {
    if (!email) return;
    setReenviando(true);
    const supabase = createClient();
    await supabase.auth.signInWithOtp({ email });
    setReenviando(false);
    setReenviado(true);
  }

  return (
    <div>
      <h1 className="text-2xl font-medium text-ink">Confira seu e-mail</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-muted">
        {email ? (
          <>
            Enviamos um link de acesso para <span className="text-ink">{email}</span>. Abra o e-mail
            e clique no link para entrar.
          </>
        ) : (
          "Enviamos um link de acesso para o seu e-mail. Abra o e-mail e clique no link para entrar."
        )}
      </p>

      <div className="mt-8 border-t border-line pt-6">
        <button
          type="button"
          onClick={handleReenviar}
          disabled={reenviando || !email}
          className="text-sm font-medium text-seal underline decoration-seal/40 underline-offset-4 disabled:opacity-60"
        >
          {reenviando ? "Reenviando…" : "Não recebeu? Reenviar link"}
        </button>
        {reenviado && <p className="mt-3 text-sm text-ink-muted">Link reenviado.</p>}
      </div>
    </div>
  );
}
