import { redirect } from "next/navigation";

export const metadata = { title: "Equipe & Acessos — Comitê Digital" };

export default function EquipePage() {
  redirect("/configuracoes?aba=equipe");
}
