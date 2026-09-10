"use server";

/** Compatibilidade para clientes antigos: o aceite isolado não conclui mais uma assinatura. */
export async function assinarContratoPublico(_token: string) {
  if (!_token) return { ok: false, mensagem: "Link inválido." };
  return {
    ok: false,
    mensagem: "Recarregue a página para assinar na tela e tirar a foto do rosto.",
  };
}
