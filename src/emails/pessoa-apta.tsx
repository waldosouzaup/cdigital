/**
 * E-mail de `pessoa_apta` — Seção 6: "Documentação completa e aprovada | Coordenador
 * responsável | Pessoa liberada para contrato." Vai para o coordenador, não para o
 * contratado — por isso o conteúdo pode nomear a pessoa (não é dado sensível dela
 * mesma sendo enviado a ela).
 */
import * as React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Text, render } from "react-email";

interface PessoaAptaEmailProps {
  nomePessoa: string;
  urlPainel: string;
}

function PessoaAptaEmail({ nomePessoa, urlPainel }: PessoaAptaEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{`${nomePessoa} está com a documentação completa`}</Preview>
      <Body style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", backgroundColor: "#F8FAF9", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "28px", maxWidth: "480px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
          <Heading as="h2" style={{ fontSize: "18px", color: "#0A0F0D" }}>
            Documentação aprovada
          </Heading>
          <Text style={{ color: "#0A0F0D" }}>
            <strong>{nomePessoa}</strong> teve toda a documentação conferida e aprovada. Já está
            liberado(a) para emissão de contrato.
          </Text>
          <Text>
            <Link href={urlPainel} style={{ color: "#157F58", fontWeight: "600" }}>
              Ver no painel →
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderizarEmailPessoaApta(params: PessoaAptaEmailProps) {
  const elemento = <PessoaAptaEmail {...params} />;
  const [html, text] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ]);

  return { subject: `${params.nomePessoa} está com a documentação completa`, html, text };
}
