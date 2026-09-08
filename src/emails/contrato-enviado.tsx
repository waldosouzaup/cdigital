/**
 * E-mail de `contrato_enviado` — Seção 6: "Transição emitido → enviado | Contratado
 * | Aviso de que há contrato a assinar + link." Regra 7: nada de CPF/endereço/valor
 * no corpo — só avisa que existe algo a assinar.
 */
import { Body, Container, Head, Heading, Html, Link, Preview, Text, render } from "react-email";

interface ContratoEnviadoEmailProps {
  primeiroNome: string;
  objeto: string;
  urlContato: string;
}

// Sem página pública de assinatura ainda (Fase 2, item 12 — "registro de
// assinatura" — não faz parte desta parte da fase): o e-mail avisa e orienta a
// aguardar contato, em vez de prometer um link de assinatura que não existe.
function ContratoEnviadoEmail({ primeiroNome, objeto, urlContato }: ContratoEnviadoEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Seu contrato está pronto</Preview>
      <Body style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#eceeeb", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "24px", maxWidth: "480px" }}>
          <Heading as="h2" style={{ fontSize: "18px", color: "#1b2430" }}>
            Olá, {primeiroNome}
          </Heading>
          <Text style={{ color: "#1b2430" }}>
            Seu contrato de <strong>{objeto}</strong> foi emitido. A coordenação da sua região vai
            entrar em contato com as instruções para a assinatura.
          </Text>
          <Text>
            <Link href={urlContato} style={{ color: "#b8752e" }}>
              Saiba mais sobre o Comitê Digital
            </Link>
          </Text>
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
