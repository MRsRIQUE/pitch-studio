import * as React from "react";
import type { Metadata } from "next";
import { Estruturar } from "@/components/estruturar/Estruturar";

export const metadata: Metadata = {
  title: "Estruturar a ideia",
};

/* A tela lê `?modo=ugc` com `useSearchParams`, que obriga a um limite de
   Suspense para a rota não estourar na pré-renderização — mesma regra da
   página de Estilos. */
export default function EstruturarPage() {
  return (
    <React.Suspense fallback={null}>
      <Estruturar />
    </React.Suspense>
  );
}
