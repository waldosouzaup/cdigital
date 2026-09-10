/**
 * E-mail de `contrato_enviado` — Seção 6: "Transição emitido → enviado | Contratado
 * | Aviso de que há contrato a assinar + link." Regra 7: nada de CPF/endereço/valor
 * no corpo — só avisa que existe algo a assinar.
 */
import * as React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Text, render } from "react-email";

interface ContratoEnviadoEmailProps {
  primeiroNome: string;
  objeto: string;
  urlAssinatura?: string;
  urlContato?: string;
}

function ContratoEnviadoEmail({ primeiroNome, objeto, urlAssinatura, urlContato }: ContratoEnviadoEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Seu contrato está pronto para assinatura</Preview>
      <Body style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", backgroundColor: "#F8FAF9", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "28px", maxWidth: "520px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
          <Heading as="h2" style={{ fontSize: "18px", color: "#0A0F0D", marginTop: 0 }}>
            Olá, {primeiroNome}
          </Heading>
          <Text style={{ color: "#0A0F0D", lineHeight: "1.5" }}>
            Seu contrato de <strong>{objeto}</strong> foi emitido com sucesso e está disponível para a sua
            conferência e assinatura eletrônica.
          </Text>

          {urlAssinatura ? (
            <div style={{ margin: "24px 0", textAlign: "center" }}>
              <Link
                href={urlAssinatura}
                style={{
                  backgroundColor: "#1FA871",
                  color: "#ffffff",
                  padding: "14px 28px",
                  display: "inline-block",
                  textDecoration: "none",
                  fontWeight: "bold",
                  borderRadius: "6px",
                  fontSize: "15px",
                }}
              >
                Visualizar e Assinar Contrato →
              </Link>
              <Text style={{ fontSize: "12px", color: "#52605B", marginTop: "12px" }}>
                Clique no botão acima para ler o contrato em PDF e realizar sua assinatura digital.
              </Text>
            </div>
          ) : (
            <Text style={{ color: "#0A0F0D", lineHeight: "1.5" }}>
              A coordenação da sua região entrará em contato com as instruções para a assinatura.
            </Text>
          )}

          {urlContato && (
            <Text style={{ marginTop: "24px", borderTop: "1px solid #E2E8F0", paddingTop: "16px" }}>
              <Link href={urlContato} style={{ color: "#157F58", fontSize: "13px" }}>
                Saiba mais sobre o Comitê Digital
              </Link>
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  );
}

export async function renderizarEmailContratoEnviado(params: ContratoEnviadoEmailProps) {
  const elemento = <ContratoEnviadoEmail {...params} />;
  const [html, text] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ]);

  return { subject: "Seu contrato foi emitido", html, text };
}
