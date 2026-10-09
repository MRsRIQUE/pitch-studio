"use client";

/* ============================================================
   /projeto/<id> — redirecionamento

   A leva 7 juntou as duas vistas numa tela só: o painel de chat passou a
   conviver com o `WorkflowCanvas` de verdade, em `/workflow/<id>`.

   Quem sobrevive é `/workflow/<id>`, por três razões:

   1. A barra lateral aponta para `/workflow`, e `/workflow` é a lista de
      projetos — a rota de detalhe tem que ser filha dela.
   2. `app/workflow/[id]/page.tsx` e `components/WorkflowCanvas.tsx` estão
      CONGELADOS. A tela única é montada por cima deles, pelo
      `app/workflow/layout.tsx`; mover isso para `/projeto` exigiria uma
      cópia da página congelada.
   3. `/projeto/<id>` nunca funcionou em carga fria — a guarda do
      `PainelProjeto` disparava antes de o `persist` reidratar e jogava o
      usuário na galeria. Está reportado desde a leva 4.

   O redirecionamento fica para os links que já existem por aí. É `replace`,
   não `push`: voltar tem que sair da tela, não repetir o salto.
   ============================================================ */

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProjetoRedireciona({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/workflow/${id}`);
  }, [id, router]);

  return null;
}
