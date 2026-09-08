"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Marca } from "@/components/marca";
import { Alerta } from "@/components/alerta";

function LoginConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(
    searchParams.get("erro") === "link"
      ? "O link de acesso expirou ou já foi usado. Peça um novo abaixo."
      : null,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emailLimpo = email.trim();
    if (!emailLimpo) return;

    setErro(null);
    setEnviando(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: emailLimpo,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });

      setEnviando(false);

      if (error) {
        setErro(error.message);
        return;
      }

      router.push(`/verificacao?email=${encodeURIComponent(emailLimpo)}`);
    } catch {
      setEnviando(false);
      setErro("Não foi possível enviar o link de acesso. Tente novamente.");
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0d1728] p-8 sm:p-10 shadow-2xl">
      <div className="mb-8 text-center">
        <div className="inline-flex justify-center mb-5">
          <Marca subtitulo="" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Entrar</h1>
        <p className="mt-2 text-sm text-slate-400">
          Informe seu e-mail para receber o link de acesso
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-1.5">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com"
            className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow font-medium"
          />
        </div>

        {erro && (
          <Alerta tom="critico" titulo="Não foi possível entrar">
            {erro}
          </Alerta>
        )}

        <button
          type="submit"
          disabled={enviando || !email.trim()}
          className="btn-gold w-full py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50"
        >
          {enviando ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
              <span>Enviando link…</span>
            </>
          ) : (
            "Enviar link de acesso"
          )}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginConteudo />
    </Suspense>
  );
}

