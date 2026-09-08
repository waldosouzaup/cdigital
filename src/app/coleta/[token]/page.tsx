/**
 * Link Público de Coleta (/coleta/[token]) — Fase 2, item 2. Sem login: a validação
 * do token acontece via `validar_link_coleta`, função SECURITY DEFINER (migration
 * 0005) que não expõe nada além do primeiro nome e do nome da organização (Seção 6:
 * "nada além do primeiro nome").
 *
 * O upload de documento (Fase 2, item 3) ainda não foi construído — este fluxo
 * coleta só os dados complementares (telefone, endereço, dados bancários) que faltam
 * na pessoa já cadastrada pelo coordenador.
 */
import { Marca } from "@/components/marca";
import { Alerta } from "@/components/alerta";
import { createClient } from "@/lib/supabase/server";
import { ColetaCliente } from "./coleta-cliente";

interface ResultadoValidarLink {
  pessoa_id: string;
  primeiro_nome: string;
  organizacao_nome: string;
  expira_em: string;
}

export default async function ColetaPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("validar_link_coleta", { p_token: token })
    .maybeSingle<ResultadoValidarLink>();

  if (error || !data) {
    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <Marca className="justify-center" />
          <Alerta tom="critico" titulo="Link inválido ou expirado">
            Este link de coleta já foi usado ou não é mais válido. Peça um novo link à
            coordenação do seu comitê.
          </Alerta>
        </div>
      </div>
    );
  }

  return (
    <ColetaCliente
      token={token}
      primeiroNome={data.primeiro_nome}
      organizacaoNome={data.organizacao_nome}
    />
  );
}
