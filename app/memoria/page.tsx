import type { Metadata } from "next";
import { Memoria } from "@/components/memoria/Memoria";

export const metadata: Metadata = {
  title: "Memória",
  description: "Conversas, projetos, gerações e pastas num grafo só.",
};

export default function PaginaMemoria() {
  return <Memoria />;
}
