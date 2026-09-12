/**
 * E-mail de `distrato_enviado` — rescisão contratual do integrante. Regra 7: sem
 * CPF ou dado bancário; informa a formalização, o período apurado e o valor
 * proporcional nos termos da legislação eleitoral.
 * Moldura institucional em `layout.tsx`.
 */
import * as React from "react";
import { render } from "react-email";
import { CORES, CaixaEmail, LayoutEmail, LinhaDado, TextoEmail } from "./layout";

export interface DistratoEnviadoEmailProps {
  primeiroNome: string;
  objeto: string;
  dataDistrato: string;
  periodoTrabalhado: string;
  valorProporcional: string;
  motivo?: string;
  urlContato?: string;
}

export function DistratoEnviadoEmail({
  primeiroNome,
  objeto,
  dataDistrato,
  periodoTrabalhado,
  valorProporcional,
  motivo,
  urlContato,
}: DistratoEnviadoEmailProps) {
  return (
    <LayoutEmail
      previa="Formalização do Termo de Distrato Contratual"
      titulo={`Olá, ${primeiroNome}`}
      urlPortal={urlContato}
    >
      <TextoEmail>
        A formalização do <strong>Termo de Distrato / Rescisão</strong> do contrato de{" "}
        <strong>{objeto}</strong> foi registrada no sistema em <strong>{dataDistrato}</strong>.
      </TextoEmail>

      <CaixaEmail titulo="Resumo da rescisão">
        <LinhaDado rotulo="Período apurado" valor={periodoTrabalhado} />
        <LinhaDado
          rotulo="Valor proporcional calculado"
          valor={<strong style={{ color: CORES.primariaEscura }}>{valorProporcional}</strong>}
        />
        {motivo && <LinhaDado rotulo="Motivo informado" valor={motivo} />}
      </CaixaEmail>

      <TextoEmail style={{ fontSize: "13px", color: CORES.tintaSuave }}>
        O termo formal foi anexado e registrado pela coordenação da campanha em conformidade com as
        exigências de prestação de contas eleitorais. Se precisar de uma cópia assinada ou de
        esclarecimentos, fale com a equipe administrativa.
      </TextoEmail>
    </LayoutEmail>
  );
}

export async function renderizarEmailDistratoEnviado(params: DistratoEnviadoEmailProps) {
  const elemento = <DistratoEnviadoEmail {...params} />;
  const [html, text] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ]);

  return {
    subject: "Formalização do Termo de Distrato Contratual",
    html,
    text,
  };
}
