"use client";

import { useCallback, useRef, useState } from "react";

export interface DadosGeolocalizacao {
  status: "pendente" | "concedida" | "recusada" | "indisponivel";
  latitude?: number | null;
  longitude?: number | null;
  precisao?: number | null;
  timestampCliente?: string;
}

interface OpcoesAuditoria {
  token?: string;
  slug?: string;
  tipo: "coleta" | "inscricao";
}

export function useAuditoriaColeta({ token, slug, tipo }: OpcoesAuditoria) {
  const [geolocalizacao, setGeolocalizacao] = useState<DadosGeolocalizacao>({
    status: "pendente",
  });
  const rastreioIniciadoRef = useRef(false);

  const enviarEventoAuditoria = useCallback(
    async (geo: DadosGeolocalizacao) => {
      try {
        const endpoint =
          tipo === "coleta" && token
            ? `/api/coleta/${token}/auditoria`
            : tipo === "inscricao" && slug
              ? `/api/inscricao/${slug}/auditoria`
              : null;

        if (!endpoint) return;

        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            acao: "inicio_preenchimento",
            geolocalizacao: geo,
            timestampCliente: new Date().toISOString(),
          }),
        });
      } catch (err) {
        // Falhas na auditoria não devem travar a experiência do usuário
        console.warn("[Auditoria] Aviso: não foi possível registrar evento:", err);
      }
    },
    [tipo, token, slug],
  );

  const registrarInicioPreenchimento = useCallback(() => {
    if (rastreioIniciadoRef.current) return;
    rastreioIniciadoRef.current = true;

    const agora = new Date().toISOString();

    if (typeof window === "undefined" || !navigator.geolocation) {
      const geoIndisponivel: DadosGeolocalizacao = {
        status: "indisponivel",
        timestampCliente: agora,
      };
      setGeolocalizacao(geoIndisponivel);
      enviarEventoAuditoria(geoIndisponivel);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        const geoConcedida: DadosGeolocalizacao = {
          status: "concedida",
          latitude: posicao.coords.latitude,
          longitude: posicao.coords.longitude,
          precisao: posicao.coords.accuracy,
          timestampCliente: new Date(posicao.timestamp).toISOString(),
        };
        setGeolocalizacao(geoConcedida);
        enviarEventoAuditoria(geoConcedida);
      },
      () => {
        const geoRecusada: DadosGeolocalizacao = {
          status: "recusada",
          timestampCliente: agora,
        };
        setGeolocalizacao(geoRecusada);
        enviarEventoAuditoria(geoRecusada);
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 60000,
      },
    );
  }, [enviarEventoAuditoria]);

  return {
    geolocalizacao,
    registrarInicioPreenchimento,
  };
}
