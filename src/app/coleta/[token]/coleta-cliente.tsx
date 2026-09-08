"use client";

import { useActionState, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { Marca } from "@/components/marca";
import { Campo } from "@/components/campo";
import { Selo } from "@/components/selo";
import { Alerta } from "@/components/alerta";
import { Badge } from "@/components/badge";
import { enviarDadosColeta } from "./acoes";
import { ESTADO_INICIAL_ENVIAR_DADOS } from "./estado";

/**
 * Fluxo real (Fase 2, itens 2 e 3) — 3 etapas, não as 4 do desenho original: a
 * pessoa já foi cadastrada pelo coordenador (nome/CPF/região), então não faz
 * sentido pedir de novo. O upload de documento (etapa 2) valida do lado do
 * servidor (`/api/coleta/[token]/documento`) — o que aparece aqui de imediato
 * (tamanho, prévia) é só conveniência, quem decide de verdade é o servidor.
 */
export function ColetaCliente({
  token,
  primeiroNome,
  organizacaoNome,
}: {
  token: string;
  primeiroNome: string;
  organizacaoNome: string;
}) {
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [consentimento, setConsentimento] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Etapa 2 — documento
  const [enviandoDocumento, setEnviandoDocumento] = useState(false);
  const [erroDocumento, setErroDocumento] = useState<string | null>(null);
  const [documentoEnviado, setDocumentoEnviado] = useState(false);
  const [nomeArquivoEnviado, setNomeArquivoEnviado] = useState<string | null>(null);

  const enviarComToken = enviarDadosColeta.bind(null, token);
  const [estado, formAction, pendente] = useActionState(
    enviarComToken,
    ESTADO_INICIAL_ENVIAR_DADOS,
  );

  if (estado.status === "sucesso") {
    return (
      <TelaSucesso
        primeiroNome={primeiroNome}
        organizacaoNome={organizacaoNome}
        token={token}
        documentoEnviado={documentoEnviado}
      />
    );
  }

  async function handleArquivoSelecionado(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;

    setErroDocumento(null);
    setEnviandoDocumento(true);
    setDocumentoEnviado(false);

    try {
      const corpo = new FormData();
      corpo.append("arquivo", arquivo);

      const resposta = await fetch(`/api/coleta/${token}/documento`, {
        method: "POST",
        body: corpo,
      });
      const resultado = await resposta.json();

      if (!resposta.ok || !resultado.ok) {
        setErroDocumento(resultado.motivo ?? "Não foi possível enviar o documento.");
        return;
      }

      setDocumentoEnviado(true);
      setNomeArquivoEnviado(arquivo.name);
    } catch {
      setErroDocumento("Falha de conexão ao enviar o documento. Tente novamente.");
    } finally {
      setEnviandoDocumento(false);
      // Permite escolher o mesmo arquivo de novo (por exemplo, depois de corrigir
      // e tentar de novo) — sem isso o navegador ignora uma segunda seleção idêntica.
      evento.target.value = "";
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col justify-between">
      <header className="border-b border-line bg-surface px-4 py-3 sticky top-0 z-30">
        <div className="mx-auto max-w-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Marca className="text-small" />
            <span className="text-[0.7rem] font-mono text-ink-muted border-l border-line pl-2">
              COLETA SEGURA
            </span>
          </div>
          <Badge status="enviado" rotuloPersonalizado={organizacaoNome} />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-mono text-ink-muted mb-2">
            <span>ETAPA {etapa} DE 3</span>
            <span>
              {etapa === 1 && "DADOS COMPLEMENTARES"}
              {etapa === 2 && "DOCUMENTO"}
              {etapa === 3 && "REVISÃO E ENVIO"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 h-1 bg-line">
            <div className={`h-full ${etapa >= 1 ? "bg-seal" : "bg-transparent"}`} />
            <div className={`h-full ${etapa >= 2 ? "bg-seal" : "bg-transparent"}`} />
            <div className={`h-full ${etapa >= 3 ? "bg-seal" : "bg-transparent"}`} />
          </div>
        </div>

        <form ref={formRef} action={formAction} className="space-y-6">
          {/* ETAPA 1: DADOS COMPLEMENTARES — só aparece/desaparece via CSS, não
              desmonta, para o form manter os valores digitados ao ir e voltar. */}
          <div className={etapa === 1 ? "space-y-6" : "hidden"}>
            <div className="space-y-2">
              <h1 className="text-h1 font-semibold text-ink leading-tight">
                Olá, {primeiroNome}
              </h1>
              <p className="text-small text-ink-muted leading-relaxed">
                Complete os dados abaixo para a formalização do seu contrato de trabalho
                temporário com {organizacaoNome}.
              </p>
            </div>

            <div className="space-y-4 border-t border-line pt-6">
              <Campo
                rotulo="Telefone celular (WhatsApp)"
                id="telefone"
                name="telefone"
                mono
                required
                inputMode="tel"
                placeholder="(00) 00000-0000"
                auxiliar="Você receberá avisos sobre o contrato por aqui."
              />
              <Campo
                rotulo="E-mail"
                id="email"
                name="email"
                type="email"
                placeholder="seu@email.com"
              />
              <Campo rotulo="RG" id="rg" name="rg" mono required placeholder="00.000.000-0" />
              <Campo
                rotulo="Data de nascimento"
                id="dataNascimento"
                name="dataNascimento"
                type="date"
                required
              />
              <Campo
                rotulo="Endereço"
                id="endereco"
                name="endereco"
                required
                placeholder="Rua, número, bairro"
              />
              <Campo
                rotulo="CEP"
                id="cep"
                name="cep"
                mono
                required
                inputMode="numeric"
                placeholder="00000-000"
              />
              <Campo
                rotulo="Banco"
                id="banco"
                name="banco"
                required
                placeholder="Nome do banco"
              />
              <div className="grid grid-cols-2 gap-4">
                <Campo rotulo="Agência" id="agencia" name="agencia" mono required />
                <Campo rotulo="Conta" id="conta" name="conta" mono required />
              </div>
            </div>

            <div className="pt-2">
              <Selo
                type="button"
                voz="selo"
                className="w-full py-3.5 text-base"
                onClick={() => setEtapa(2)}
              >
                Continuar para envio de documento →
              </Selo>
            </div>
          </div>

          {/* ETAPA 2: DOCUMENTO */}
          <div className={etapa === 2 ? "space-y-6" : "hidden"}>
            <div className="space-y-2">
              <h1 className="text-h1 font-semibold text-ink leading-tight">
                Documento de Identidade
              </h1>
              <p className="text-small text-ink-muted leading-relaxed">
                Fotografe seu <strong>RG</strong> (frente e verso) ou sua <strong>CNH aberta</strong>.
                Certifique-se de que as informações estejam nítidas e sem reflexos.
              </p>
            </div>

            <div className="border-t border-line pt-6 space-y-4">
              <label
                htmlFor="upload-doc"
                className="block border-2 border-dashed border-line hover:border-seal p-6 text-center bg-surface/60 cursor-pointer transition-colors"
              >
                <input
                  id="upload-doc"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  capture="environment"
                  className="hidden"
                  disabled={enviandoDocumento}
                  onChange={handleArquivoSelecionado}
                />
                <div className="space-y-2">
                  <div className="font-mono text-2xl text-seal">
                    {enviandoDocumento ? "…" : documentoEnviado ? "✓" : "📷"}
                  </div>
                  <div className="text-small font-medium text-ink">
                    {enviandoDocumento
                      ? "Enviando e verificando…"
                      : documentoEnviado
                        ? `Enviado: ${nomeArquivoEnviado}`
                        : "Tirar foto ou anexar documento"}
                  </div>
                  <p className="text-xs text-ink-muted">Formatos JPG, PNG ou PDF até 20 MB</p>
                </div>
              </label>

              {erroDocumento && (
                <Alerta tom="critico" titulo="Não foi possível aceitar este arquivo">
                  {erroDocumento}
                </Alerta>
              )}

              {documentoEnviado && (
                <Alerta tom="sucesso" titulo="Documento recebido">
                  Já pode avançar para a revisão final.
                </Alerta>
              )}

              <div className="p-3 bg-surface border-l-2 border-info text-xs text-ink-muted space-y-1">
                <strong>Dica de qualidade:</strong>
                <p>
                  Coloque o documento sobre uma mesa bem iluminada e evite usar o flash
                  diretamente sobre o plástico de proteção.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Selo
                type="button"
                voz="selo"
                onClick={() => setEtapa(3)}
                disabled={!documentoEnviado || enviandoDocumento}
                className="w-full py-3.5 text-base"
              >
                Avançar para revisão →
              </Selo>
              {!documentoEnviado && (
                <Selo
                  type="button"
                  voz="linha"
                  onClick={() => setEtapa(3)}
                  className="text-center text-xs"
                >
                  Enviar o documento depois, continuar sem ele por enquanto
                </Selo>
              )}
              <Selo
                type="button"
                voz="linha"
                onClick={() => setEtapa(1)}
                className="text-center text-xs"
              >
                ← Voltar e revisar os dados
              </Selo>
            </div>
          </div>

          {/* ETAPA 3: REVISÃO, CONSENTIMENTO E ENVIO */}
          <div className={etapa === 3 ? "space-y-6" : "hidden"}>
            <div className="space-y-2">
              <h1 className="text-h1 font-semibold text-ink leading-tight">
                Revisão e Consentimento
              </h1>
              <p className="text-small text-ink-muted leading-relaxed">
                Confira se os dados e o documento das etapas anteriores estão corretos antes de
                enviar.
              </p>
            </div>

            {estado.status === "erro" && (
              <Alerta tom="critico" titulo="Não foi possível concluir">
                {estado.mensagem}
              </Alerta>
            )}

            <div className="p-4 border border-line bg-surface/40 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={consentimento}
                  onChange={(e) => setConsentimento(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-line text-seal focus:ring-seal"
                />
                <span className="text-xs leading-relaxed text-ink">
                  Declaro que as informações e o documento fornecidos são verídicos e autorizo sua
                  utilização exclusiva para a{" "}
                  <strong>formalização do contrato de trabalho temporário</strong> e para a{" "}
                  <strong>prestação de contas eleitoral perante a Justiça Eleitoral</strong>, em
                  conformidade com a Lei Geral de Proteção de Dados (LGPD).
                </span>
              </label>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Selo
                type="submit"
                voz="selo"
                disabled={!consentimento || pendente}
                carregando={pendente}
                textoCarregando="Transmitindo informações com segurança…"
                className="w-full py-3.5 text-base"
              >
                Concluir e Enviar Cadastro
              </Selo>
              <Selo
                type="button"
                voz="linha"
                onClick={() => setEtapa(2)}
                className="text-center text-xs"
              >
                ← Voltar para o documento
              </Selo>
            </div>
          </div>
        </form>
      </main>

      <footer className="border-t border-line bg-surface px-4 py-3 text-center text-xs text-ink-muted">
        <span>Ambiente Criptografado · Conforme Resolução TSE nº 23.607</span>
      </footer>
    </div>
  );
}

function TelaSucesso({
  primeiroNome,
  organizacaoNome,
  token,
  documentoEnviado,
}: {
  primeiroNome: string;
  organizacaoNome: string;
  token: string;
  documentoEnviado: boolean;
}) {
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col justify-between">
      <main className="flex-1 mx-auto w-full max-w-md px-4 py-10 space-y-6 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success text-3xl font-mono">
          ✓
        </div>

        <div className="space-y-2">
          <h1 className="text-h1 font-semibold text-ink">Cadastro recebido com sucesso!</h1>
          <p className="text-small text-ink-muted leading-relaxed">
            Obrigado, <strong>{primeiroNome}</strong>. Seus dados{documentoEnviado ? " e documento" : ""}{" "}
            foram recebidos pela coordenação de {organizacaoNome}.
          </p>
        </div>

        <div className="p-5 border border-line bg-surface text-left space-y-3">
          <div className="font-mono text-xs text-seal uppercase tracking-wider">
            Comprovante de Envio
          </div>
          <div className="space-y-1 text-xs text-ink-muted">
            <p>
              Protocolo:{" "}
              <span className="font-mono text-ink font-semibold">
                REC-{token.slice(0, 8).toUpperCase()}
              </span>
            </p>
            <p>
              Status:{" "}
              <span className="text-success font-medium">
                {documentoEnviado ? "Dados e documento recebidos" : "Dados recebidos"}
              </span>
            </p>
          </div>
        </div>

        {!documentoEnviado && (
          <Alerta tom="atencao" titulo="Documento pendente">
            Você concluiu sem enviar o documento de identidade. A coordenação vai entrar em
            contato para pedir o envio separadamente.
          </Alerta>
        )}

        <div className="p-4 bg-paper border border-line text-xs text-ink-muted leading-relaxed">
          <strong>Próximos passos:</strong>
          <p className="mt-1">
            Assim que o contrato for emitido, você receberá um novo link para assinatura.
          </p>
        </div>

        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex text-small text-seal underline decoration-seal/40 hover:decoration-seal"
          >
            Conhecer mais sobre o Comitê Digital
          </Link>
        </div>
      </main>
    </div>
  );
}
