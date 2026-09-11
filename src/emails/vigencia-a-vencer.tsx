/**
 * E-mail de `vigencia_a_vencer` — Seção 6: "7 e 3 dias do término | Gestor e
 * coord. do comitê | Quantidade e link para a lista." Regra 7: sem valor de
 * contrato, sem dado da pessoa — só objeto, prazo e link para a lista no painel.
 */
import * as React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Text, render } from "react-email";

interface VigenciaAVencerEmailProps {
  objeto: string;
  diasRestantes: number;
  urlLista: string;
}

function VigenciaAVencerEmail({ objeto, diasRestantes, urlLista }: VigenciaAVencerEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Contrato a vencer em {String(diasRestantes)} dias</Preview>
      <Body style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", backgroundColor: "#F8FAF9", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "28px", maxWidth: "480px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
          <Heading as="h2" style={{ fontSize: "18px", color: "#0A0F0D" }}>
            Vigência a vencer
          </Heading>
          <Text style={{ color: "#0A0F0D" }}>
            O contrato de <strong>{objeto}</strong> termina em <strong>{diasRestantes} dias</strong>.
            Verifique se há renovação, encerramento ou distrato a providenciar.
          </Text>
          <Text>
            <Link href={urlLista} style={{ color: "#157F58", fontWeight: "600" }}>
              Abrir a lista de contratos →
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderizarEmailVigenciaAVencer(params: VigenciaAVencerEmailProps) {
  const elemento = <VigenciaAVencerEmail {...params} />;
  const [html, text] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ]);
  return {
    subject: `Contrato a vencer em ${params.diasRestantes} dias`,
    html,
    text,
  };
}
