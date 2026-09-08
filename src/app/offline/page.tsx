/**
 * Último recurso quando o service worker não tem nem a casca de /atividades em
 * cache (Fase 4, item 2). Estático de propósito — não busca nada.
 */
export const metadata = { title: "Sem conexão — Comitê Digital" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 p-6 text-ink">
      <h1 className="text-h1 font-semibold">Você está sem conexão</h1>
      <p className="text-small text-ink-muted">
        Abra o Comitê Campo de novo assim que o sinal voltar. Se você já tinha registros na fila,
        eles sobem sozinhos quando a rede retornar — nada se perde.
      </p>
    </main>
  );
}
