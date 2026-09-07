"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

  useEffect(() => {
    async function carregar() {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();

      if (error) {
        setEstado({ fase: "erro" });
        return;
      }

      const totpExistente = data.totp[0];
      if (totpExistente) {
        setEstado({ fase: "desafio", factorId: totpExistente.id });
        return;
      }

      // Primeiro login: cadastro obrigatório de TOTP (Seção 3, item 6 da Fase 1).
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

    carregar();
  }, []);

  async function handleVerificar() {
    if (estado.fase !== "cadastro" && estado.fase !== "desafio") return;

    setVerificando(true);
    setErroVerificacao(null);

    const supabase = createClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId: estado.factorId });

    if (challenge.error) {
      setErroVerificacao("Código inválido. Confira o autenticador e tente de novo.");
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
      setErroVerificacao("Código inválido. Confira o autenticador e tente de novo.");
      return;
    }

    router.push("/dashboard");
  }

  if (estado.fase === "carregando") {
    return <p className="text-sm text-ink-muted">Carregando…</p>;
  }

  if (estado.fase === "erro") {
    return (
      <p role="alert" className="text-sm text-alert">
        Não foi possível carregar a verificação em duas etapas. Recarregue a página.
      </p>
    );
  }

  const eCadastro = estado.fase === "cadastro";

  return (
    <div>
      <h1 className="text-2xl font-medium text-ink">
        {eCadastro ? "Cadastrar verificação em duas etapas" : "Verificação em duas etapas"}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        {eCadastro
          ? "Obrigatório para gestor e coordenador de comitê. Escaneie o código com um app autenticador (Google Authenticator, Authy)."
          : "Digite o código de 6 dígitos do seu app autenticador."}
      </p>

      {eCadastro && (
        <div className="mt-8 border-t border-line pt-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG data URI do Supabase, não uma imagem otimizável pelo next/image */}
          <img
            src={estado.qrCode}
            alt="Código QR para cadastro do autenticador"
            width={176}
            height={176}
          />
          <p className="mt-4 font-mono text-xs tracking-wide text-ink-muted">
            Não consegue ler o código? Digite: {estado.secret}
          </p>
        </div>
      )}

      <div className={eCadastro ? "mt-6" : "mt-8 border-t border-line pt-8"}>
        <label htmlFor="codigo" className="block text-sm font-medium text-ink">
          Código de verificação
        </label>
        <input
          id="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          value={codigo}
          onChange={(event) => setCodigo(event.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="mt-2 w-full border-b border-line bg-transparent py-2 font-mono text-lg tracking-[0.3em] text-ink outline-none focus:border-seal"
        />

        {erroVerificacao && (
          <p role="alert" className="mt-4 text-sm text-alert">
            {erroVerificacao}
          </p>
        )}

        <button
          type="button"
          onClick={handleVerificar}
          disabled={verificando || codigo.length !== 6}
          className="mt-8 w-full bg-seal py-3 text-sm font-medium text-seal-ink disabled:opacity-60"
        >
          {verificando ? "Verificando…" : "Confirmar"}
        </button>
      </div>
    </div>
  );
}
