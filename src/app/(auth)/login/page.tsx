"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setEnviando(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/mfa` },
    });

    setEnviando(false);

    if (error) {
      setErro("Não foi possível enviar o link. Confira o e-mail e tente de novo.");
      return;
    }

    router.push(`/verificacao?email=${encodeURIComponent(email)}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-medium text-ink">Entrar</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Enviamos um link de acesso para o seu e-mail cadastrado.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 border-t border-line pt-8">
        <label htmlFor="email" className="block text-sm font-medium text-ink">
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
          placeholder="voce@comite.org.br"
          className="mt-2 w-full border-b border-line bg-transparent py-2 text-ink outline-none focus:border-seal"
        />

        {erro && (
          <p role="alert" className="mt-4 text-sm text-alert">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="mt-8 w-full bg-seal py-3 text-sm font-medium text-seal-ink disabled:opacity-60"
        >
          {enviando ? "Enviando…" : "Enviar link de acesso"}
        </button>
      </form>
    </div>
  );
}
