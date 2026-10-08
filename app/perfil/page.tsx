import type { Metadata } from "next";
import { Perfil } from "@/components/perfil/Perfil";

export const metadata: Metadata = {
  title: "Perfil",
  description: "Créditos, gerações, projetos e a atividade do workspace.",
};

export default function PaginaPerfil() {
  return <Perfil />;
}
