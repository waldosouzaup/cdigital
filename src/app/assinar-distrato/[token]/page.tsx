/**
 * Assinatura pública do termo de distrato (`/assinar-distrato/[token]`).
 *
 * Rota separada de `/assinar/[token]` de propósito: a capacidade é outra
 * (`token_assinatura_distrato`), o documento é outro e o estado de destino é
 * outro. Reaproveitar o mesmo caminho exigiria um modo dentro de uma tela que já
 * é o ponto mais sensível do sistema.
 *
 * O SHA-256 do termo vem da própria RPC de validação, então a tela não precisa
 * de uma ida extra ao PDF só para saber o que está assinando.
 */
import { Marca } from "@/components/marca";
import { Alerta } from "@/components/alerta";
import { createClient } from "@/lib/supabase/server";
import { AssinarDistratoCliente, type DadosDistratoAssinatura } from "./assinar-distrato-cliente";

export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

interface LinhaValidarDistrato {
  contrato_id: string;
  pessoa_id: string;
  nome_completo: string;
  primeiro_nome: string;
  cpf: string;
  objeto: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  status: "distratado" | "distrato_assinado";
  organizacao_nome: string;
  caminho_termo: string | null;
  termo_sha256: string | null;
  distrato_assinado_em: string | null;
}

export default async function AssinaturaDistratoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: linha, error } = await supabase
    .rpc("validar_link_assinatura_distrato", { p_token: token })
    .maybeSingle<LinhaValidarDistrato>();

  if (error || !linha) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <Marca className="justify-center" />
          <Alerta tom="critico" titulo="Link de assinatura inválido ou não encontrado">
            Este link de distrato não é válido ou expirou. Entre em contato com a coordenação para
            receber um novo link.
          </Alerta>
        </div>
      </div>
    );
  }

  const distrato: DadosDistratoAssinatura = {
    contratoId: linha.contrato_id,
    nomeCompleto: linha.nome_completo,
    primeiroNome: linha.primeiro_nome,
    cpf: linha.cpf,
    objeto: linha.objeto,
    vigenciaInicio: linha.vigencia_inicio,
    vigenciaFim: linha.vigencia_fim,
    status: linha.status,
    organizacaoNome: linha.organizacao_nome,
    termoSha256: linha.termo_sha256,
    assinadoEm: linha.distrato_assinado_em,
  };

  return <AssinarDistratoCliente token={token} distrato={distrato} />;
}
