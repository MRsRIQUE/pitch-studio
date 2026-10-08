"use client";

/* ============================================================
   BOTÃO 7 — DITADO

   `Voice input` na referência. Aqui é a Web Speech API do próprio
   navegador: nenhum backend novo, nenhum áudio saindo do aparelho por
   nossa conta. Onde ela não existe — Firefox, e todo navegador sem o
   motor da Google — o botão fica desabilitado com o motivo no `title`,
   que é o que a regra manda fazer em vez de esconder o controle.

   O texto ditado é ANEXADO ao que já está escrito, nunca substitui: a
   pessoa costuma ditar a continuação de uma frase que começou a digitar.
   ============================================================ */

import * as React from "react";
import "@/app/gallery/composer.css";

/* A API não está nos tipos do DOM em todas as versões do TypeScript, e
   `webkitSpeechRecognition` nunca esteve. O contrato mínimo que usamos
   fica declarado aqui, e só ele. */
type ResultadoFala = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};
type Reconhecedor = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: ResultadoFala) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type FabricaReconhecedor = new () => Reconhecedor;

function fabrica(): FabricaReconhecedor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: FabricaReconhecedor;
    webkitSpeechRecognition?: FabricaReconhecedor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const semAssinatura = () => () => {};

function IconeMicrofone() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19v3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <rect x="9" y="2" width="6" height="13" rx="3" />
    </svg>
  );
}

export function BotaoDitado({
  onTexto,
  disabled,
}: {
  /** Recebe o trecho reconhecido, já pronto para ser anexado. */
  onTexto: (trecho: string) => void;
  disabled?: boolean;
}) {
  /* A checagem é uma leitura do navegador, não estado do React: no
     servidor não há `window`, e o `useSyncExternalStore` é exatamente o
     caminho que devolve o valor neutro na renderização do servidor e o
     verdadeiro na hidratação, sem um render extra. */
  const suportado = React.useSyncExternalStore(
    semAssinatura,
    () => fabrica() !== null,
    () => null as boolean | null,
  );
  const [ouvindo, setOuvindo] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const recRef = React.useRef<Reconhecedor | null>(null);

  React.useEffect(() => () => { recRef.current?.stop(); }, []);

  const alternar = () => {
    if (ouvindo) { recRef.current?.stop(); return; }
    const Fabrica = fabrica();
    if (!Fabrica) return;

    const rec = new Fabrica();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const alt = e.results[i];
        if (alt.isFinal) onTexto(alt[0].transcript.trim());
      }
    };
    rec.onerror = (e) => {
      setErro(e.error === "not-allowed"
        ? "O navegador negou o acesso ao microfone"
        : "O ditado falhou. Tente de novo.");
      setOuvindo(false);
    };
    rec.onend = () => setOuvindo(false);
    recRef.current = rec;
    setErro(null);
    setOuvindo(true);
    rec.start();
  };

  const indisponivel = suportado === false;
  const rotulo = indisponivel
    ? "Ditado: este navegador não tem reconhecimento de fala"
    : ouvindo
      ? "Parar o ditado"
      : erro ?? "Ditar o prompt";

  return (
    <button
      type="button"
      className="pc-icon-btn"
      data-open={ouvindo ? "true" : undefined}
      disabled={disabled || indisponivel || suportado === null}
      aria-label={rotulo}
      aria-pressed={ouvindo}
      title={rotulo}
      onClick={alternar}
    >
      <IconeMicrofone />
    </button>
  );
}
