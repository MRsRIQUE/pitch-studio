"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Personagens } from "@/components/personagens/Personagens";

/* `useSearchParams` obriga a um limite de Suspense para a rota não estourar na
   pré-renderização — mesma regra da página de Estilos. O único parâmetro lido
   é `modo=referencia`: a porta que a receita UGC usa para abrir o editor já no
   modo "a partir de foto". */
export default function PersonagensPage() {
  return (
    <React.Suspense fallback={null}>
      <PersonagensComModo />
    </React.Suspense>
  );
}

function PersonagensComModo() {
  const searchParams = useSearchParams();
  const modo = searchParams.get("modo");
  return <Personagens modoInicial={modo === "referencia" ? "referencia" : undefined} />;
}
