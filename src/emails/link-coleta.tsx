/**
 * E-mail de `link_coleta` — Seção 6: "Link e prazo. Nada além do primeiro nome."
 * Nenhum dado sensível (CPF, endereço, valor) entra no corpo — Regra 7 e NFR de
 * e-mail (Seção 10). Moldura institucional em `layout.tsx`.
 */
import * as React from "react";
import { render } from "react-email";
import { BotaoEmail, CaixaEmail, LayoutEmail, TextoEmail, TextoMiudo } from "./layout";

interface LinkColetaEmailProps {
  primeiroNome: string;
  url: string;
  prazoDias: number;
}

function LinkColetaEmail({ primeiroNome, url, prazoDias }: LinkColetaEmailProps) {
  const plural = prazoDias === 1 ? "" : "s";
  return (
    <LayoutEmail
      previa={`Link para enviar seus dados — válido por ${prazoDias} dia${plural}`}
      titulo={`Olá, ${primeiroNome}`}
    >
      <TextoEmail>
        A coordenação da campanha precisa dos seus dados de contato e de um documento. Use o botão
        abaixo para enviá-los com segurança.
      </TextoEmail>

      <BotaoEmail href={url}>Enviar meus dados</BotaoEmail>

      <CaixaEmail tom="atencao" titulo="Atenção ao prazo">
        <TextoEmail style={{ margin: 0, fontSize: "14px" }}>
          Este link vale por <strong>{prazoDias} dia{plural}</strong> e só pode ser usado uma vez.
        </TextoEmail>
      </CaixaEmail>

      <TextoMiudo>
        Se o botão não funcionar, copie e cole este endereço no navegador: {url}
      </TextoMiudo>
      <TextoMiudo>Se você não esperava este e-mail, é seguro ignorá-lo.</TextoMiudo>
    </LayoutEmail>
  );
}

export async function renderizarEmailLinkColeta(params: LinkColetaEmailProps) {
  const elemento = <LinkColetaEmail {...params} />;
  const [html, text] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ]);

  return {
    subject: `Link para envio de dados — válido por ${params.prazoDias} dia${params.prazoDias === 1 ? "" : "s"}`,
    html,
    text,
  };
}
