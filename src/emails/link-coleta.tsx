/**
 * E-mail de `link_coleta` — Seção 6: "Link e prazo. Nada além do primeiro nome."
 * Nenhum dado sensível (CPF, endereço, valor) entra no corpo — Regra 7 e NFR de
 * e-mail (Seção 10).
 */
import * as React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Text, render } from "react-email";

interface LinkColetaEmailProps {
  primeiroNome: string;
  url: string;
  prazoDias: number;
}

function LinkColetaEmail({ primeiroNome, url, prazoDias }: LinkColetaEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{`Link para enviar seus dados — válido por ${prazoDias} dia${prazoDias === 1 ? "" : "s"}`}</Preview>
      <Body style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", backgroundColor: "#F8FAF9", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "28px", maxWidth: "480px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
          <Heading as="h2" style={{ fontSize: "18px", color: "#0A0F0D" }}>
            Olá, {primeiroNome}
          </Heading>
          <Text style={{ color: "#0A0F0D" }}>
            Use o link abaixo para enviar seus dados de contato e o documento pedidos pela
            coordenação da campanha. Ele vale por {prazoDias} dia{prazoDias === 1 ? "" : "s"} e só
            pode ser usado uma vez.
          </Text>
          <Text>
            <Link href={url} style={{ color: "#157F58", fontWeight: "600" }}>
              {url}
            </Link>
          </Text>
          <Text style={{ fontSize: "12px", color: "#52605B" }}>
            Se você não esperava este e-mail, é seguro ignorá-lo.
          </Text>
        </Container>
      </Body>
    </Html>
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
