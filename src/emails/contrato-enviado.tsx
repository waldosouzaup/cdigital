/**
 * E-mail de `contrato_enviado` — Seção 6: "Transição emitido → enviado | Contratado
 * | Aviso de que há contrato a assinar + link." Regra 7: nada de CPF/endereço/valor
 * no corpo — só avisa que existe algo a assinar.
 * Moldura institucional em `layout.tsx`.
 */
import * as React from "react";
import { render } from "react-email";
import { BotaoEmail, CaixaEmail, LayoutEmail, LinhaDado, TextoEmail, TextoMiudo } from "./layout";

interface ContratoEnviadoEmailProps {
  primeiroNome: string;
  objeto: string;
  urlAssinatura?: string;
  urlContato?: string;
}

function ContratoEnviadoEmail({
  primeiroNome,
  objeto,
  urlAssinatura,
  urlContato,
}: ContratoEnviadoEmailProps) {
  return (
    <LayoutEmail
      previa="Seu contrato está pronto para assinatura"
      titulo={`Olá, ${primeiroNome}`}
      urlPortal={urlContato}
      rotuloPortal="Saiba mais sobre o Comitê Digital"
    >
      <TextoEmail>
        Seu contrato de prestação de serviços foi emitido e está disponível para conferência e
        assinatura eletrônica.
      </TextoEmail>

      <CaixaEmail titulo="Contrato emitido">
        <LinhaDado rotulo="Objeto" valor={<strong>{objeto}</strong>} />
        <LinhaDado rotulo="Situação" valor="Aguardando sua assinatura" />
      </CaixaEmail>

      {urlAssinatura ? (
        <>
          <BotaoEmail href={urlAssinatura}>Visualizar e assinar contrato</BotaoEmail>
          <TextoMiudo>
            Leia o contrato em PDF e realize a assinatura digital pelo botão acima. Se ele não
            funcionar, copie e cole este endereço no navegador: {urlAssinatura}
          </TextoMiudo>
        </>
      ) : (
        <TextoEmail>
          A coordenação da sua região entrará em contato com as instruções para a assinatura.
        </TextoEmail>
      )}
    </LayoutEmail>
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
