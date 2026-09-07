import { Suspense } from "react";
import { VerificacaoConteudo } from "./conteudo";

// `useSearchParams` exige Suspense no App Router (Next.js 15) — sem isso o build
// falha ou a página perde a otimização estática.
export default function VerificacaoPage() {
  return (
    <Suspense fallback={null}>
      <VerificacaoConteudo />
    </Suspense>
  );
}
