"use client";

import { useEffect, useState } from "react";
import GridReveal from "./GridReveal";

/** Keep the same grid alive from job start through image arrival. */
export function ImageGenerationReveal({ busy, src, aspect = 1, caption = "Gerando imagem…" }: {
  busy: boolean; src?: string | null; aspect?: number; caption?: string;
}) {
  const [active, setActive] = useState(busy);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (busy) { setActive(true); setRun(value => value + 1); }
    else if (!src) setActive(false);
  }, [busy, src]);
  if (!active) return null;
  return <GridReveal key={run} src={busy ? null : src} aspect={aspect}
    estimatedDuration={45000} caption={busy ? caption : "Revelando imagem…"}
    className="absolute inset-0 z-10 h-full rounded-none pointer-events-none"
    style={{ aspectRatio: "auto" }} alt="Prévia da imagem gerada"
    onRevealComplete={() => setActive(false)} onError={() => setActive(false)} />;
}
