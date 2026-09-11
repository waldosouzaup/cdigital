"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Marca } from "@/components/marca";
import { Campo } from "@/components/campo";
import { Selo } from "@/components/selo";
import { Alerta } from "@/components/alerta";
import { SeletorTema } from "@/components/seletor-tema";
import { useAuditoriaColeta } from "@/lib/coleta/use-auditoria-coleta";
import { inscreverCandidato } from "./acoes";
import { ESTADO_INICIAL_INSCRICAO } from "./estado";

export function InscricaoCliente({
  slug,
  organizacaoNome,
  regioes,
  funcoes,
}: {
  slug: string;
  organizacaoNome: string;
  regioes: { id: string; nome: string }[];
  funcoes: string[];
}) {
  const router = useRouter();
  const [consentimento, setConsentimento] = useState(false);
  const { geolocalizacao, registrarInicioPreenchimento } = useAuditoriaColeta({
    slug,
    tipo: "inscricao",
  });
  const [estado, formAction, pendente] = useActionState(
    inscreverCandidato.bind(null, slug),
    ESTADO_INICIAL_INSCRICAO,
  );

  useEffect(() => {
    if (estado.status === "sucesso" && estado.token) {
      const destino = `/coleta/${estado.token}`;
      const t = setTimeout(() => router.push(destino), estado.jaExistia ? 1900 : 300);
      return () => clearTimeout(t);
    }
  }, [estado, router]);

  if (estado.status === "sucesso") {
    return (
      <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <Marca className="justify-center" />
          <Alerta tom="sucesso" titulo="Inscrição recebida">
            {estado.jaExistia
              ? "Encontramos um cadastro com este CPF. Você será levado para o envio dos documentos."
              : "Agora é só enviar seus documentos. Redirecionando…"}
          </Alerta>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto w-full max-w-lg px-4 py-10">
        <div className="flex items-center justify-between">
          <Marca />
          <SeletorTema />
        </div>
        <header className="mt-6 border-b border-line pb-4">
          <h1 className="text-h1 font-semibold">Inscrição — {organizacaoNome}</h1>
          <p className="mt-1 text-small text-ink-muted">
            Preencha seus dados para se candidatar a uma vaga local. Depois você envia os
            documentos pelo celular, sem criar conta.
          </p>
        </header>

        {/* Indicador de ambiente seguro e auditado */}
        <div className="mt-4 flex items-center justify-between text-[0.6875rem] font-mono text-ink-muted bg-surface/80 border border-line px-3 py-1.5 rounded">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span>Ambiente Seguro &amp; Auditado</span>
          </div>
          <span className="text-[0.65rem] text-ink-muted">
            {geolocalizacao.status === "concedida" ? "✓ Localização capturada" : "IP & Horário Registrados"}
          </span>
        </div>

        {estado.status === "erro" && estado.mensagem && (
          <div className="mt-4">
            <Alerta tom="critico">{estado.mensagem}</Alerta>
          </div>
        )}

        <form
          action={formAction}
          className="mt-6 space-y-5"
          onFocusCapture={registrarInicioPreenchimento}
          onChangeCapture={registrarInicioPreenchimento}
        >
          <input
            type="hidden"
            name="geolocalizacao"
            value={JSON.stringify(geolocalizacao)}
          />
          <Campo
            rotulo="Nome completo"
            id="nomeCompleto"
            name="nomeCompleto"
            required
            maxLength={120}
            erro={estado.status === "erro" ? estado.errors?.nomeCompleto : undefined}
          />
          <Campo
            rotulo="CPF"
            id="cpf"
            name="cpf"
            mono
            required
            inputMode="numeric"
            placeholder="000.000.000-00"
            erro={estado.status === "erro" ? estado.errors?.cpf : undefined}
          />
          <Campo
            rotulo="Telefone (WhatsApp)"
            id="telefone"
            name="telefone"
            mono
            required
            inputMode="tel"
            placeholder="(61) 90000-0000"
            erro={estado.status === "erro" ? estado.errors?.telefone : undefined}
          />
          <Campo
            rotulo="E-mail"
            id="email"
            name="email"
            type="email"
            required
            erro={estado.status === "erro" ? estado.errors?.email : undefined}
          />
          <Campo.Selecao
            rotulo="Região / Localidade"
            id="regiaoId"
            name="regiaoId"
            required
            defaultValue=""
            erro={estado.status === "erro" ? estado.errors?.regiaoId : undefined}
          >
            <option value="" disabled>
              Selecione a região
            </option>
            {regioes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </Campo.Selecao>
          <Campo.Selecao
            rotulo="Função pretendida"
            id="funcao"
            name="funcao"
            required
            defaultValue=""
            erro={estado.status === "erro" ? estado.errors?.funcao : undefined}
          >
            <option value="" disabled>
              Selecione a função
            </option>
            {funcoes.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Campo.Selecao>

          <label className="flex items-start gap-2.5 text-xs text-ink-muted">
            <input
              type="checkbox"
              name="consentimento"
              required
              checked={consentimento}
              onChange={(e) => setConsentimento(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Autorizo o comitê a tratar meus dados pessoais para fins de seleção, contratação e
              prestação de contas da campanha, conforme a LGPD.
            </span>
          </label>
          {estado.status === "erro" && estado.errors?.consentimento && (
            <p className="text-xs text-alert">{estado.errors.consentimento}</p>
          )}

          <Selo
            voz="selo"
            type="submit"
            carregando={pendente}
            textoCarregando="Enviando…"
            disabled={!consentimento || pendente}
          >
            Enviar inscrição
          </Selo>
        </form>
      </div>
    </div>
  );
}
