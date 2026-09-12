"use client";

/**
 * Coordenada do registro de atividade de campo (migration 0038).
 *
 * Pede a posição uma vez ao abrir a tela e mantém a última leitura em memória,
 * em vez de pedir no momento de gravar. O registro rápido é "3 toques" por
 * projeto (Fase 4, item 1): esperar o GPS no envio transformaria isso em três
 * toques mais uma espera de vários segundos, e a atividade é o dado que importa
 * — a coordenada é evidência complementar.
 *
 * Por isso nada aqui bloqueia: sem permissão, sem sinal ou sem suporte, o
 * registro segue sem coordenada.
 */
import { useEffect, useRef, useState } from "react";

export type StatusCoordenada = "pendente" | "capturada" | "recusada" | "indisponivel";

export interface CoordenadaAtual {
  status: StatusCoordenada;
  latitude: number | null;
  longitude: number | null;
  precisaoM: number | null;
}

const INICIAL: CoordenadaAtual = {
  status: "pendente",
  latitude: null,
  longitude: null,
  precisaoM: null,
};

export function useCoordenadaAtual(): CoordenadaAtual {
  const [coordenada, setCoordenada] = useState<CoordenadaAtual>(INICIAL);
  const pedidoFeitoRef = useRef(false);

  useEffect(() => {
    if (pedidoFeitoRef.current) return;
    pedidoFeitoRef.current = true;

    if (typeof window === "undefined" || !navigator.geolocation) {
      setCoordenada({ ...INICIAL, status: "indisponivel" });
      return;
    }

    let ativo = true;
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        if (!ativo) return;
        setCoordenada({
          status: "capturada",
          latitude: posicao.coords.latitude,
          longitude: posicao.coords.longitude,
          precisaoM: Number.isFinite(posicao.coords.accuracy) ? posicao.coords.accuracy : null,
        });
      },
      (erro) => {
        if (!ativo) return;
        setCoordenada({
          ...INICIAL,
          status: erro.code === erro.PERMISSION_DENIED ? "recusada" : "indisponivel",
        });
      },
      // `maximumAge` alto de propósito: em campo a pessoa registra várias
      // atividades seguidas no mesmo ponto, e reusar a leitura evita acender o
      // GPS a cada registro — o que custa bateria num turno inteiro.
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 },
    );

    return () => {
      ativo = false;
    };
  }, []);

  return coordenada;
}

/** Rótulo curto para o indicador de status na tela. */
export function rotuloCoordenada(status: StatusCoordenada): string {
  switch (status) {
    case "capturada":
      return "Local capturado";
    case "recusada":
      return "Local não autorizado";
    case "indisponivel":
      return "Local indisponível";
    default:
      return "Obtendo local…";
  }
}
