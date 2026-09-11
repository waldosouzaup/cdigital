/**
 * E-mail de `lembrete_assinatura` — Seção 6: "3 dias em `enviado` sem assinar |
 * Contratado, com cópia ao coordenador | Lembrete." Regra 7: nada além do
 * primeiro nome e do objeto; o dado fica no painel, atrás de autenticação.
 */
import * as React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Text, render } from "react-email";

interface LembreteAssinaturaEmailProps {
  primeiroNome: string;
  objeto: string;
  urlContato: string;
  /** Quando true, o texto fala com o coordenador, não com o contratado. */
  paraCoordenador?: boolean;
}

function LembreteAssinaturaEmail({
  primeiroNome,
  objeto,
  urlContato,
  paraCoordenador = false,
}: LembreteAssinaturaEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Contrato aguardando assinatura</Preview>
      <Body style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", backgroundColor: "#F8FAF9", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "28px", maxWidth: "480px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
          <Heading as="h2" style={{ fontSize: "18px", color: "#0A0F0D" }}>
            {paraCoordenador ? "Assinatura pendente" : `Olá, ${primeiroNome}`}
          </Heading>
          <Text style={{ color: "#0A0F0D" }}>
            {paraCoordenador ? (
              <>
                O contrato de <strong>{objeto}</strong> de {primeiroNome} está há 3 dias enviado sem
                assinatura. Uma cobrança pode destravar.
              </>
            ) : (
              <>
                Seu contrato de <strong>{objeto}</strong> está aguardando assinatura há alguns dias.
                A coordenação da sua região pode orientar os próximos passos.
              </>
            )}
          </Text>
          <Text>
            <Link href={urlContato} style={{ color: "#157F58", fontWeight: "600" }}>
              {paraCoordenador ? "Abrir a lista de contratos →" : "Saiba mais sobre o Comitê Digital →"}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderizarEmailLembreteAssinatura(params: LembreteAssinaturaEmailProps) {
  const elemento = <LembreteAssinaturaEmail {...params} />;
  const [html, text] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ]);
  return { subject: "Contrato aguardando assinatura", html, text };
}
