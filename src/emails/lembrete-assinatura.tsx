/**
 * E-mail de `lembrete_assinatura` — Seção 6: "3 dias em `enviado` sem assinar |
 * Contratado, com cópia ao coordenador | Lembrete." Regra 7: nada além do
 * primeiro nome e do objeto; o dado fica no painel, atrás de autenticação.
 */
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
      <Body style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#eceeeb", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "24px", maxWidth: "480px" }}>
          <Heading as="h2" style={{ fontSize: "18px", color: "#1b2430" }}>
            {paraCoordenador ? "Assinatura pendente" : `Olá, ${primeiroNome}`}
          </Heading>
          <Text style={{ color: "#1b2430" }}>
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
            <Link href={urlContato} style={{ color: "#b8752e" }}>
              {paraCoordenador ? "Abrir a lista de contratos" : "Saiba mais sobre o Comitê Digital"}
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
