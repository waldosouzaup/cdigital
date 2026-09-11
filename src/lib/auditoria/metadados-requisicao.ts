import { headers } from "next/headers";

export interface MetadadosRequisicao {
  ip: string | null;
  userAgent: string | null;
  geoHeaders: {
    cidade: string | null;
    estado: string | null;
    pais: string | null;
    latitude: string | null;
    longitude: string | null;
  };
}

/**
 * Extrai IP e metadados de auditoria a partir dos cabeçalhos da requisição HTTP.
 * Compatível tanto com Route Handlers (passando request.headers) quanto com
 * Server Actions (usando next/headers).
 */
export async function extrairMetadadosAuditoria(
  headersEntrada?: Headers,
): Promise<MetadadosRequisicao> {
  const h = headersEntrada ?? (await headers());

  const xForwardedFor = h.get("x-forwarded-for");
  const ip =
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    (xForwardedFor ? xForwardedFor.split(",")[0].trim() : null);

  const userAgent = h.get("user-agent")?.slice(0, 500) ?? null;

  const geoHeaders = {
    cidade: h.get("x-vercel-ip-city") || h.get("cf-ipcity") || null,
    estado: h.get("x-vercel-ip-country-region") || h.get("cf-region") || null,
    pais: h.get("x-vercel-ip-country") || h.get("cf-ipcountry") || null,
    latitude: h.get("x-vercel-ip-latitude") || null,
    longitude: h.get("x-vercel-ip-longitude") || null,
  };

  return { ip, userAgent, geoHeaders };
}
