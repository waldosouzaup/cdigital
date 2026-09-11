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

      {/* Acesso para demonstração do projeto */}
      <div className="mt-6 border border-line bg-surface-raised/60 p-4 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-ink">
              Acesso para Demonstração
            </span>
          </div>
          <span className="text-[0.65rem] font-mono text-ink-muted bg-surface px-2 py-0.5 border border-line rounded">
            Perfil Gestor
          </span>
        </div>
        <p className="text-xs text-ink-muted leading-relaxed">
          Utilize as credenciais abaixo para acessar o sistema e conhecer o projeto:
        </p>
        <div className="bg-canvas border border-line p-2.5 rounded-lg space-y-1.5 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">E-mail:</span>
            <span className="font-semibold text-ink select-all">contato@waldoeller.com</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Senha:</span>
            <span className="font-semibold text-ink select-all">Admin@2026</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setEmail("contato@waldoeller.com");
            setSenha("Admin@2026");
            setErro(null);
          }}
          className="w-full py-2 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition cursor-pointer border border-primary/20 flex items-center justify-center gap-1.5"
        >
          <span>⚡ Preencher dados de demonstração</span>
        </button>
      </div>
    </div>
  );
}
