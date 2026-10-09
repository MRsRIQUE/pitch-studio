"use client";

import Link from "next/link";
import type { StoredMessage } from "@/lib/chatSessionStore";
import { usePersonagensStore } from "@/lib/personagensStore";
import { GeracaoPendente } from "@/components/personagens/GeracaoPendente";

export function ChatArtifact({ artifact }: { artifact: NonNullable<StoredMessage["artifact"]> }) {
  const personagem = usePersonagensStore(s => s.personagens.find(p => p.id === artifact.id));
  const workflow = artifact.tipo === "workflow";
  return <div className="rounded-ms-lg border border-ms-border p-4 flex flex-col gap-2">
    <strong>{workflow ? "Workflow" : "Personagem"}: {artifact.nome}</strong>
    {!workflow && personagem && <>
      <GeracaoPendente personagem={personagem} />
      {personagem.fotos[0] && /* URLs de uploads e gerações locais. */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={personagem.fotos[personagem.fotos.length - 1]} alt={`Retrato de ${personagem.nome}`} className="w-40 rounded-ms-lg" />}
      <p className="text-ms-sm text-ms-text-secondary" role="status">{personagem.geracao ? "Gerando retrato… Você pode continuar conversando." : personagem.erroGeracao || (personagem.fotos.length ? "Retrato pronto e salvo na biblioteca." : "Ficha salva na biblioteca.")}</p>
    </>}
    <Link className="underline" href={workflow ? `/workflow/${encodeURIComponent(artifact.id)}` : "/personagens"}>{workflow ? "Abrir workflow" : "Abrir personagens"} →</Link>
  </div>;
}
