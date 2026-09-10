"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Selo } from "@/components/selo";
import { Alerta } from "@/components/alerta";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro" }
  | { fase: "cadastro"; factorId: string; qrCode: string; secret: string }
  | { fase: "desafio"; factorId: string };

export default function MfaPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [codigo, setCodigo] = useState("");
  const [erroVerificacao, setErroVerificacao] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();

      // Sem sessão (acesso direto a /mfa, sem link mágico) -> manda para o login.
      const { data: sessao } = await supabase.auth.getSession();
      if (!sessao.session) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        setEstado({ fase: "erro" });
        return;
      }

      // MFA/TOTP é OPCIONAL (migration 0018 — o RLS não exige mais `aal2`). Esta
      // tela é só o cadastro/verificação voluntário, alcançável por "Segurança" em
      // /configuracoes. Já tem fator verificado -> nada a fazer.
      const verificado = data?.totp?.find((f) => f.status === "verified");
      if (verificado) {
        router.replace("/dashboard");
        return;
      }

      // Fator cadastrado mas ainda não verificado -> tela de desafio.
      const pendente = data?.totp?.[0];
      if (pendente) {
        setEstado({ fase: "desafio", factorId: pendente.id });
        return;
      }

      // Primeiro acesso: cadastra o fator TOTP e mostra o QR real.
      const enroll = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (enroll.error || !enroll.data) {
        setEstado({ fase: "erro" });
        return;
      }

      setEstado({
        fase: "cadastro",
        factorId: enroll.data.id,
        qrCode: enroll.data.totp.qr_code,
        secret: enroll.data.totp.secret,
      });
    }

    void carregar();
  }, [router]);

  async function handleCopiarSegredo(segredo: string) {
    if (!navigator?.clipboard) return;
    await navigator.clipboard.writeText(segredo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  }

  async function handleVerificar() {
    if (estado.fase !== "cadastro" && estado.fase !== "desafio") return;

    setVerificando(true);
    setErroVerificacao(null);

    try {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId: estado.factorId });

      if (challenge.error) {
        setErroVerificacao("Não foi possível iniciar a verificação. Recarregue e tente de novo.");
        setVerificando(false);
        return;
      }

      const verify = await supabase.auth.mfa.verify({
        factorId: estado.factorId,
        challengeId: challenge.data.id,
        code: codigo,
      });

      setVerificando(false);

      if (verify.error) {
        setErroVerificacao(
          "Código inválido ou expirado. Aguarde o app gerar o próximo e tente de novo.",
        );
        return;
      }

      // Sessão agora é aal2 — o middleware/RLS liberam o painel.
      router.replace("/dashboard");
    } catch {
      setErroVerificacao("Falha na verificação. Confira sua conexão e tente novamente.");
      setVerificando(false);
    }
  }

  if (estado.fase === "carregando") {
    return (
      <div className="py-12 space-y-3 text-center">
        <div className="inline-block h-5 w-5 animate-spin border-2 border-seal border-t-transparent rounded-full" />
        <p className="text-small text-ink-muted">Preparando verificação de segurança…</p>
      </div>
    );
  }

  if (estado.fase === "erro") {
    return (
      <div className="space-y-4">
        <Alerta tom="critico" titulo="Não foi possível iniciar a verificação em duas etapas">
          Ocorreu uma instabilidade na comunicação com o serviço de autenticação.
        </Alerta>
        <Selo voz="linha" onClick={() => window.location.reload()}>
          Recarregar página
        </Selo>
      </div>
    );
  }

  const eCadastro = estado.fase === "cadastro";

  return (
    <div className="rounded-2xl border border-line bg-surface p-8 sm:p-10 shadow-card space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {eCadastro ? "Configurar autenticador" : "Código de verificação"}
        </h1>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">
          {eCadastro
            ? "Escaneie o QR Code com o aplicativo autenticador ou use a chave manual."
            : "Digite o código de 6 dígitos gerado no seu aplicativo autenticador."}
        </p>
      </div>

      {eCadastro && (
        <div className="space-y-4 border-t border-line pt-5">
          <div className="p-4 border border-line bg-surface-sunken rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="shrink-0 border border-line bg-surface p-2 rounded-lg shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={estado.qrCode}
                  alt="QR Code para emparelhamento TOTP"
                  width={140}
                  height={140}
                  className="block"
                />
              </div>

              <div className="space-y-2 text-xs text-ink-muted">
                <p className="font-semibold text-ink text-sm">Como configurar:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-ink-muted">
                  <li>
                    Abra o <strong className="text-ink font-medium">Google Authenticator</strong> ou{" "}
                    <strong className="text-ink font-medium">Authy</strong>.
                  </li>
                  <li>Aponte a câmera para o QR Code.</li>
                  <li>Digite o código gerado abaixo.</li>
                </ol>
              </div>
            </div>

            <div className="border-t border-line pt-3">
              <span className="block text-xs text-ink-muted mb-1 font-mono">
                Chave para configuração manual:
              </span>
              <div className="flex items-center justify-between gap-2 bg-surface p-2.5 rounded-lg border border-line">
                <span className="font-mono text-xs text-primary font-bold tracking-wider break-all select-all">
                  {estado.secret}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopiarSegredo(estado.secret)}
                  className="shrink-0 px-2.5 py-1 text-xs font-semibold text-white bg-primary rounded hover:bg-primary-hover cursor-pointer transition"
                >
                  {copiado ? "Copiado ✓" : "Copiar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={eCadastro ? "space-y-4" : "border-t border-line pt-5 space-y-4"}>
        <div>
          <label
            htmlFor="codigo"
            className="block text-xs font-medium text-ink-muted mb-1.5 text-center"
          >
            Código de 6 dígitos
          </label>
          <input
            id="codigo"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={codigo}
            onChange={(event) => setCodigo(event.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-center text-3xl font-mono tracking-[0.4em] text-primary placeholder:text-ink-subtle outline-none transition focus:border-primary focus:ring-1 focus:ring-primary font-bold"
          />
        </div>

        {erroVerificacao && (
          <Alerta tom="critico" titulo="Código inválido">
            {erroVerificacao}
          </Alerta>
        )}

        <button
          type="button"
          onClick={handleVerificar}
          disabled={verificando || codigo.length !== 6}
          className="w-full py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer transition bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {verificando ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Verificando…</span>
            </>
          ) : (
            "Confirmar código"
          )}
        </button>

        <div className="pt-2 text-center text-xs text-ink-muted">
          <Link href="/configuracoes" className="hover:text-primary hover:underline transition">
            ← Voltar
          </Link>
        </div>
      </div>
    </div>
  );
}
