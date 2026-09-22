import type { Metadata } from "next";
import { TendenciasPage } from "@/components/tendencias/TendenciasPage";

/* ============================================================
   TENDÊNCIAS — o motor de tendências (docs/roadmap-motor-tendencias.md)

   Passo 4.1: importar o post de referência (link TikTok/Instagram ou
   mp4) para o acervo local. Fatiamento, análise e o "usar esta
   tendência" chegam nos passos seguintes, sobre esta mesma tela.
   ============================================================ */

export const metadata: Metadata = {
  title: "Tendências",
  description: "Posts que já performaram, guardados para derivar estrutura e movimento.",
};

export default function PaginaTendencias() {
  return <TendenciasPage />;
}
