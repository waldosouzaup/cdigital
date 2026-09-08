/**
 * Contratos — Fase 2, itens 8/9(parcial)/10/11/13(parcial). Server Component busca
 * dado real; o Client Component cuida de filtro/abas e dos modais de ação.
 */
import { listarContratos, listarPessoasAptasSemContratoAtivo, listarTemplatesAtivos } from "./dados";
import { ContratosCliente } from "./contratos-cliente";

export default async function ContratosPage() {
  const [contratos, pessoasAptas, templates] = await Promise.all([
    listarContratos(),
    listarPessoasAptasSemContratoAtivo(),
    listarTemplatesAtivos(),
  ]);

  return (
    <ContratosCliente
      contratosIniciais={contratos}
      pessoasAptas={pessoasAptas}
      templates={templates}
    />
  );
}
