"use client";

/* ============================================================
   /projeto — redirecionamento

   A porta sem id abria o projeto ativo. Com a tela única da leva 7 esse
   papel é da lista de `/workflow`, que já leva a `/workflow/<id>`.

   Vai direto ao projeto ativo quando existe um; senão, à lista. Assim um
   link velho para `/projeto` cai onde o usuário estava, não numa tela
   genérica. Ver o comentário de `app/projeto/[id]/page.tsx` para o porquê
   de `/workflow` ser a rota que sobreviveu.
   ============================================================ */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkflowStore } from "@/lib/store";

export default function ProjetoRedireciona() {
  const router = useRouter();
  const ativo = useWorkflowStore((s) => s.activeSpaceId);
  const spaces = useWorkflowStore((s) => s.spaces);

  useEffect(() => {
    /* Sem o space na lista, o id ativo é o padrão que o store cria do nada
       antes de o `persist` hidratar — mandar para ele daria uma tela vazia. */
    const existe = spaces.some((s) => s.id === ativo);
    router.replace(existe ? `/workflow/${ativo}` : "/workflow");
  }, [ativo, spaces, router]);

  return null;
}
