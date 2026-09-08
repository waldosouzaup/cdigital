"use client";

import { useEffect } from "react";

/**
 * Registra o service worker `/sw.js` (Fase 4, item 2). Sem ele o navegador não
 * oferece "instalar app" e a casca de /atividades não abre offline. Componente
 * sem UI — montado pela tela de campo.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sem SW o app ainda funciona online; só não fica instalável/offline.
    });
  }, []);

  return null;
}
