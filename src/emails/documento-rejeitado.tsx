/**
 * E-mail de `documento_rejeitado` — Fase 2, item 3 / Seção 6: "motivo em linguagem
 * simples e link para reenviar". Mesmo cuidado do link_coleta: nada sensível no
 * corpo (Regra 7). Moldura institucional em `layout.tsx`.
 */
import * as React from "react";
import { render } from "react-email";
import { BotaoEmail, CaixaEmail, LayoutEmail, TextoEmail, TextoMiudo } from "./layout";

interface DocumentoRejeitadoEmailProps {
  primeiroNome: string;
  motivo: string;
  urlReenvio: string;
}

function DocumentoRejeitadoEmail({
  primeiroNome,
  motivo,
  urlReenvio,
}: DocumentoRejeitadoEmailProps) {
  return (
    <LayoutEmail
      previa="Não foi possível aceitar o documento enviado — tente novamente"
      titulo={`Olá, ${primeiroNome}`}
    >
      <TextoEmail>
        O documento que você enviou não pôde ser aceito pela conferência da coordenação. É só
        reenviar — leva menos de um minuto.
      </TextoEmail>

      <CaixaEmail tom="critico" titulo="Motivo da recusa">
        <TextoEmail style={{ margin: 0, fontSize: "14px" }}>{motivo}</TextoEmail>
      </CaixaEmail>

      <BotaoEmail href={urlReenvio}>Enviar o documento novamente</BotaoEmail>

      <TextoMiudo>
        Se o botão não funcionar, copie e cole este endereço no navegador: {urlReenvio}
      </TextoMiudo>
    </LayoutEmail>
  );
}

export async function renderizarEmailDocumentoRejeitado(params: DocumentoRejeitadoEmailProps) {
  const elemento = <DocumentoRejeitadoEmail {...params} />;
  const [html, text] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ]);

  return { subject: "Não foi possível aceitar o documento enviado", html, text };
}
