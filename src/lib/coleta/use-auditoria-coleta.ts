"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AcaoAuditoriaPublica } from "@/lib/auditoria/acoes-publicas";

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

/** Contexto do navegador que só existe no cliente e ajuda a situar o acesso. */
function contextoNavegador() {
  if (typeof window === "undefined") return {};
  return {
    referrer: document.referrer || null,
    // Fuso e idioma dizem muito sobre a origem do acesso e, ao contrário do GPS,
    // não custam nada nem pedem permissão.
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    idioma: navigator.language ?? null,
    resolucao: `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}`,
  };
}

export function useAuditoriaColeta({ token, slug, tipo }: OpcoesAuditoria) {
  const [geolocalizacao, setGeolocalizacao] = useState<DadosGeolocalizacao>({
    status: "pendente",
  });
  const rastreioIniciadoRef = useRef(false);
  const acessoRegistradoRef = useRef(false);

  const enviarEventoAuditoria = useCallback(
    async (acao: AcaoAuditoriaPublica, geo: DadosGeolocalizacao | null) => {
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
            acao,
            geolocalizacao: geo,
            timestampCliente: new Date().toISOString(),
            contexto: contextoNavegador(),
          }),
        });
      } catch (err) {
        // Falhas na auditoria não devem travar a experiência do usuário
        console.warn("[Auditoria] Aviso: não foi possível registrar evento:", err);
      }
    },
    [tipo, token, slug],
  );

  /**
   * Registro de abertura da página. Deliberadamente NÃO toca em
   * `navigator.geolocation`: um prompt de permissão no instante em que o link
   * abre costuma ser recusado e afasta candidato legítimo. A localização
   * aproximada vem do IP, no servidor; o GPS preciso só é pedido quando a pessoa
   * demonstra intenção de preencher.
   */
  useEffect(() => {
    if (acessoRegistradoRef.current) return;
    acessoRegistradoRef.current = true;
    enviarEventoAuditoria("acesso_pagina", null);
  }, [enviarEventoAuditoria]);

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
      enviarEventoAuditoria("inicio_preenchimento", geoIndisponivel);
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
        enviarEventoAuditoria("inicio_preenchimento", geoConcedida);
      },
      () => {
        const geoRecusada: DadosGeolocalizacao = {
          status: "recusada",
          timestampCliente: agora,
        };
        setGeolocalizacao(geoRecusada);
        enviarEventoAuditoria("inicio_preenchimento", geoRecusada);
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
