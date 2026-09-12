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

/** Forma do `x-nf-geo` do Netlify, já decodificado. Campos todos opcionais. */
interface GeoNetlify {
  city?: string;
  country?: { code?: string; name?: string };
  subdivision?: { code?: string; name?: string };
  latitude?: number;
  longitude?: number;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor : null;
}

function numeroComoTexto(valor: unknown): string | null {
  return typeof valor === "number" && Number.isFinite(valor) ? String(valor) : null;
}

/**
 * Geolocalização do Netlify — `x-nf-geo`, JSON em base64.
 *
 * O código só lia os cabeçalhos da Vercel e da Cloudflare, que este deploy nunca
 * recebe: por isso `headers_geo` saía todo nulo nas auditorias reais da
 * autoinscrição, e a única localização disponível era o GPS do navegador, que
 * depende de o visitante conceder permissão.
 */
function lerGeoNetlify(h: Headers): MetadadosRequisicao["geoHeaders"] | null {
  const bruto = h.get("x-nf-geo");
  if (!bruto) return null;

  try {
    const decodificado = JSON.parse(
      Buffer.from(bruto, "base64").toString("utf8"),
    ) as GeoNetlify;

    return {
      cidade: texto(decodificado.city),
      estado: texto(decodificado.subdivision?.code),
      pais: texto(decodificado.country?.code),
      latitude: numeroComoTexto(decodificado.latitude),
      longitude: numeroComoTexto(decodificado.longitude),
    };
  } catch {
    // Cabeçalho corrompido não pode derrubar a rota de auditoria inteira:
    // cai para as demais fontes como se ele não tivesse vindo.
    return null;
  }
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
    h.get("x-nf-client-connection-ip") ||
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    (xForwardedFor ? xForwardedFor.split(",")[0].trim() : null);

  const userAgent = h.get("user-agent")?.slice(0, 500) ?? null;

  const geoHeaders = lerGeoNetlify(h) ?? {
    cidade: h.get("x-vercel-ip-city") || h.get("cf-ipcity") || null,
    estado: h.get("x-vercel-ip-country-region") || h.get("cf-region") || null,
    pais: h.get("x-vercel-ip-country") || h.get("cf-ipcountry") || null,
    latitude: h.get("x-vercel-ip-latitude") || null,
    longitude: h.get("x-vercel-ip-longitude") || null,
  };

  return { ip, userAgent, geoHeaders };
}
