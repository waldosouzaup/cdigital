import { listarContratos, listarTemplatesAtivos } from "./dados";
import { ContratosCliente } from "./contratos-cliente";

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pagina = Number(params.pagina);
  const porPagina = Number(params.porPagina);
  const [paginaContratos, templates] = await Promise.all([
    listarContratos({
      busca: typeof params.busca === "string" ? params.busca.trim().slice(0, 120) : "",
      status: typeof params.status === "string" ? params.status.trim() : "",
      aba: params.aba === "distratos" ? "distratos" : "ativos",
      pagina: Number.isSafeInteger(pagina) && pagina > 0 ? Math.min(pagina, 100000) : 1,
      porPagina: [10, 20, 50, 100].includes(porPagina) ? porPagina : 20,
    }),
    listarTemplatesAtivos(),
  ]);
  return <ContratosCliente paginaContratos={paginaContratos} templates={templates} />;
}
