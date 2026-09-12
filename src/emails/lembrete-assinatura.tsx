/**
 * E-mail de `lembrete_assinatura` — Seção 6: "3 dias em `enviado` sem assinar |
 * Contratado, com cópia ao coordenador | Lembrete." Regra 7: nada além do
 * primeiro nome e do objeto; o dado fica no painel, atrás de autenticação.
 * Moldura institucional em `layout.tsx`.
 */
import * as React from "react";
import { render } from "react-email";
import { BotaoEmail, CaixaEmail, LayoutEmail, TextoEmail } from "./layout";

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
    <LayoutEmail
      previa="Contrato aguardando assinatura"
      titulo={paraCoordenador ? "Assinatura pendente" : `Olá, ${primeiroNome}`}
    >
      {paraCoordenador ? (
        <TextoEmail>
          O contrato de <strong>{objeto}</strong> de {primeiroNome} está há três dias enviado sem
          assinatura. Uma cobrança pode destravar.
        </TextoEmail>
      ) : (
        <TextoEmail>
          Seu contrato de <strong>{objeto}</strong> está aguardando assinatura há alguns dias. A
          coordenação da sua região pode orientar os próximos passos.
        </TextoEmail>
      )}

      <CaixaEmail tom="atencao">
        <TextoEmail style={{ margin: 0, fontSize: "14px" }}>
          Enquanto a assinatura não for registrada, o contrato segue pendente na prestação de
          contas da campanha.
        </TextoEmail>
      </CaixaEmail>

      <BotaoEmail href={urlContato}>
        {paraCoordenador ? "Abrir a lista de contratos" : "Falar com a coordenação"}
      </BotaoEmail>
    </LayoutEmail>
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
