"use client";
import * as React from "react";
import { usePersonagensStore, type Personagem } from "@/lib/personagensStore";

/** Jobs stay in the character store so navigation/reload can resume observation. */
export function GeracaoPendente({ personagem }: { personagem: Personagem }) {
  const taskId = personagem.geracao?.taskId;
  React.useEffect(() => {
    if (!taskId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(`/api/job-status?taskId=${encodeURIComponent(taskId)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Falha ao consultar geração");
        const data = await response.json();
        const store = usePersonagensStore.getState();
        if (controller.signal.aborted || store.personagens.find((p) => p.id === personagem.id)?.geracao?.taskId !== taskId) return;
        if (data.status === "done") {
          const url = data.imageUrl || data.imageUrls?.[0];
          if (url) store.adicionarFoto(personagem.id, url);
          store.atualizarGeracao(personagem.id, undefined, url ? undefined : "A geração terminou sem imagem.");
          window.dispatchEvent(new Event("credits-refresh"));
          return;
        }
        if (data.status === "error" || data.status === "not_found") {
          store.atualizarGeracao(personagem.id, undefined, data.error || "Não foi possível recuperar esta geração. Consulte o Acervo antes de tentar novamente.");
          return;
        }
      } catch { /* Transient failures leave the persisted task available for recovery. */ }
      if (!controller.signal.aborted) timer = setTimeout(poll, 3000);
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [taskId, personagem.id]);
  return null;
}

