"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Marca } from "@/components/marca";
import { Alerta } from "@/components/alerta";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emailLimpo = email.trim();
    if (!emailLimpo || !senha) return;

    setErro(null);
    setEntrando(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: emailLimpo,
        password: senha,
      });

      if (error) {
        setEntrando(false);
        setErro(
          /invalid login credentials/i.test(error.message)
            ? "E-mail ou senha incorretos."
            : error.message,
        );
        return;
      }

      router.push("/dashboard");
    } catch {
      setEntrando(false);
      setErro("Não foi possível entrar. Tente novamente.");
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-8 sm:p-10 shadow-card">
      <div className="mb-8 text-center">
        <div className="inline-flex justify-center mb-5">
          <Marca subtitulo="" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Entrar</h1>
        <p className="mt-2 text-sm text-ink-muted">Acesse com seu e-mail e senha institucional</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-ink mb-1.5">
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
            className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle outline-none transition focus:border-primary focus:ring-1 focus:ring-focus font-medium"
          />
        </div>

        <div>
          <label htmlFor="senha" className="block text-xs font-medium text-ink mb-1.5">
            Senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            required
            autoComplete="current-password"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            className="w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary focus:ring-1 focus:ring-focus font-medium"
          />
          <p className="mt-1.5 text-xs text-ink-muted">
            Esqueceu a senha? Peça a um gestor para redefinir seu acesso.
          </p>
        </div>

        {erro && (
          <Alerta tom="critico" titulo="Não foi possível entrar">
            {erro}
          </Alerta>
        )}

        <button
          type="submit"
          disabled={entrando || !email.trim() || !senha}
          className="w-full py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition bg-primary text-white hover:bg-primary-hover shadow-xs disabled:opacity-50"
        >
          {entrando ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Entrando…</span>
            </>
          ) : (
            "Entrar"
          )}
        </button>
      </form>
    </div>
  );
}
