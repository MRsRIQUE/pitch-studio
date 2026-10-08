"use client";

import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import GridReveal from "@/components/ui/GridReveal";

/** Indeterminate feedback: the provider supplies status, not progress percentages. */
export function GeracaoRetrato({ iniciadaEm }: { iniciadaEm: number }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const segundos = Math.max(0, Math.floor((agora - iniciadaEm) / 1000));
  const tempo = `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
  return <div className="pers-preview-loading">
    <GridReveal estimatedDuration={45000} className="absolute inset-0 h-full w-full rounded-none" style={{ aspectRatio: "auto" }} />
    <div className="pers-generation-aura" aria-hidden="true" />
    <div className="pers-generation-frame" aria-hidden="true">
      <span className="pers-generation-corner" /><span className="pers-generation-corner" />
      <span className="pers-generation-corner" /><span className="pers-generation-corner" />
      <Fingerprint size={62} strokeWidth={.9} />
      <span className="pers-generation-scan" />
    </div>
    <span className="pers-generation-caption">DANDO FORMA À SUA IDEIA</span>
    <strong role="status">Criando uma nova referência</strong>
    <span>Você pode sair e voltar. A geração continua.</span>
    <div className="pers-generation-track" aria-hidden="true"><span /></div>
    <span className="pers-generation-time" aria-hidden="true">{tempo} decorridos · aguardando o resultado</span>
  </div>;
}
