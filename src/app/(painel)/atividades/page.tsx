import { redirect } from "next/navigation";

export const metadata = { title: "Atividades de Rua — Comitê Digital" };

export default function AtividadesPage() {
  redirect("/configuracoes?aba=atividades");
}
