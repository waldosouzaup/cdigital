/**
 * Configurações — modelos de contrato (Fase 2, item 7), identidade do comitê
 * (nome/CNPJ, item 4 do feedback do coordenador) e expurgo de retenção (Fase 4,
 * item 6) são reais. O resto da governança LGPD continua informativo.
 */
import { buscarIdentidadeComite, listarTemplates } from "./dados";
import { ConfiguracoesCliente } from "./configuracoes-cliente";

export default async function ConfiguracoesPage() {
  const [templates, identidade] = await Promise.all([listarTemplates(), buscarIdentidadeComite()]);

  return <ConfiguracoesCliente templatesIniciais={templates} identidadeInicial={identidade} />;
}
