import { redirect } from "next/navigation";

export const metadata = { title: "Regiões de Atuação — Comitê Digital" };

export default function RegioesPage() {
  redirect("/configuracoes?aba=regioes");
}

