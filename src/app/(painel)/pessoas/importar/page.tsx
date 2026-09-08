/**
 * Fase 4, item 7 — importação de planilha de cadastro em lote, com conferência
 * assistida (duplicatas e linhas ilegíveis sinalizadas antes de gravar).
 */
import { ImportarCliente } from "./importar-cliente";

export const metadata = { title: "Importar cadastro em lote — Comitê Digital" };

export default function ImportarPage() {
  return <ImportarCliente />;
}
