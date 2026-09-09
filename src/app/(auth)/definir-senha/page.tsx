"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Marca } from "@/components/marca";
import { Alerta } from "@/components/alerta";
import { SENHA_MIN } from "@/lib/auth/validacao";

export default function DefinirSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const resp = await fetch("/api/conta/senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha, confirmacao }),
      });
      const dados = (await resp.json().catch(() => ({}))) as { ok?: boolean; erro?: string };
      if (!resp.ok || !dados.ok) {
        setErro(dados.erro ?? "Não foi possível trocar a senha.");
        setSalvando(false);
        return;
      }
      // O JWT ainda carrega a flag até renovar — força o refresh antes de sair.
      // Se o refresh falhar (sessão invalidada na troca), manda para o login.
      const { error: erroRefresh } = await createClient().auth.refreshSession();
      router.replace(erroRefresh ? "/login" : "/dashboard");
    } catch {
      setErro("Falha de conexão. Tente novamente.");
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0d1728] p-8 sm:p-10 shadow-2xl">
      <div className="mb-8 text-center">
        <div className="inline-flex justify-center mb-5">
          <Marca subtitulo="" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Definir uma nova senha</h1>
        <p className="mt-2 text-sm text-slate-400">
          Você entrou com uma senha temporária. Escolha uma senha sua para continuar.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="senha" className="block text-xs font-medium text-slate-300 mb-1.5">
            Nova senha (mín. {SENHA_MIN} caracteres)
          </label>
          <input
            id="senha"
            type="password"
            required
            autoFocus
            autoComplete="new-password"
            minLength={SENHA_MIN}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow"
          />
        </div>
        <div>
          <label htmlFor="confirmacao" className="block text-xs font-medium text-slate-300 mb-1.5">
            Repita a nova senha
          </label>
          <input
            id="confirmacao"
            type="password"
            required
            autoComplete="new-password"
            minLength={SENHA_MIN}
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow"
          />
        </div>

        {erro && (
          <Alerta tom="critico" titulo="Não foi possível salvar">
            {erro}
          </Alerta>
        )}

        <button
          type="submit"
          disabled={salvando || senha.length < SENHA_MIN || confirmacao.length < SENHA_MIN}
          className="btn-gold w-full py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50"
        >
          {salvando ? "Salvando…" : "Salvar e continuar"}
        </button>
      </form>
    </div>
  );
}
