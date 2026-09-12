import { describe, it, expect } from "vitest";
import { extrairMetadadosAuditoria } from "@/lib/auditoria/metadados-requisicao";

/**
 * A geolocalização por IP do servidor nunca preenchia: a função só lia cabeçalhos
 * da Vercel (`x-vercel-ip-*`) e da Cloudflare (`cf-*`), mas o deploy é Netlify.
 * As 5 auditorias reais de `/candidado-eleicao-2026` gravaram `headers_geo` todo
 * nulo por causa disso — só havia localização quando o visitante concedia GPS.
 *
 * O Netlify entrega `x-nf-geo`: JSON em base64 com city, country, subdivision,
 * timezone, latitude e longitude.
 */
function headersCom(pares: Record<string, string>): Headers {
  return new Headers(pares);
}

function geoNetlify(dados: unknown): string {
  return Buffer.from(JSON.stringify(dados), "utf8").toString("base64");
}

describe("extrairMetadadosAuditoria", () => {
  it("lê a geolocalização do cabeçalho do Netlify", async () => {
    const h = headersCom({
      "x-nf-geo": geoNetlify({
        city: "Brasília",
        country: { code: "BR", name: "Brazil" },
        subdivision: { code: "DF", name: "Distrito Federal" },
        timezone: "America/Sao_Paulo",
        latitude: -15.7797,
        longitude: -47.9297,
      }),
    });

    const { geoHeaders } = await extrairMetadadosAuditoria(h);

    expect(geoHeaders).toMatchObject({
      cidade: "Brasília",
      estado: "DF",
      pais: "BR",
      latitude: "-15.7797",
      longitude: "-47.9297",
    });
  });

  it("continua lendo os cabeçalhos da Vercel", async () => {
    const h = headersCom({
      "x-vercel-ip-city": "Brasilia",
      "x-vercel-ip-country-region": "DF",
      "x-vercel-ip-country": "BR",
      "x-vercel-ip-latitude": "-15.77",
      "x-vercel-ip-longitude": "-47.92",
    });

    const { geoHeaders } = await extrairMetadadosAuditoria(h);
    expect(geoHeaders).toMatchObject({ cidade: "Brasilia", estado: "DF", pais: "BR" });
  });

  it("continua lendo os cabeçalhos da Cloudflare", async () => {
    const h = headersCom({ "cf-ipcity": "Brasilia", "cf-region": "DF", "cf-ipcountry": "BR" });
    const { geoHeaders } = await extrairMetadadosAuditoria(h);
    expect(geoHeaders).toMatchObject({ cidade: "Brasilia", estado: "DF", pais: "BR" });
  });

  it("devolve tudo nulo quando não há cabeçalho de geo nenhum", async () => {
    const { geoHeaders } = await extrairMetadadosAuditoria(headersCom({}));
    expect(geoHeaders).toEqual({
      cidade: null,
      estado: null,
      pais: null,
      latitude: null,
      longitude: null,
    });
  });

  it("não quebra quando x-nf-geo vem corrompido", async () => {
    const h = headersCom({ "x-nf-geo": "nao-e-base64-valido!!!", "cf-ipcountry": "BR" });
    const { geoHeaders } = await extrairMetadadosAuditoria(h);
    // Cai para a próxima fonte em vez de estourar a rota de auditoria inteira.
    expect(geoHeaders.pais).toBe("BR");
  });

  it("prefere o IP de conexão do Netlify e cai para a cadeia conhecida", async () => {
    expect(
      (await extrairMetadadosAuditoria(headersCom({ "x-nf-client-connection-ip": "203.0.113.7" })))
        .ip,
    ).toBe("203.0.113.7");

    expect(
      (await extrairMetadadosAuditoria(headersCom({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })))
        .ip,
    ).toBe("203.0.113.9");
  });

  it("trunca user agent muito longo para não inchar o log", async () => {
    const h = headersCom({ "user-agent": "a".repeat(900) });
    const { userAgent } = await extrairMetadadosAuditoria(h);
    expect(userAgent).toHaveLength(500);
  });
});
