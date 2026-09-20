"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* ============================================================
   O relógio da timeline — e SÓ o relógio.

   Fica isolado de propósito: quem pinta o quadro (hoje DOM empilhado em
   TimelinePreview.tsx; amanhã canvas, se a fidelidade pixel-exata virar
   requisito) só consome `time`/`playing` daqui. Nada de mídia, DOM de
   vídeo ou layout neste arquivo.
   ============================================================ */

export interface TimelinePlayback {
  /** Instante atual da timeline, em segundos. É o playhead. */
  time: number;
  playing: boolean;
  /** Toca do ponto atual; se já está no fim, recomeça do zero. */
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (to: number) => void;
}

export function useTimelinePlayback(duration: number): TimelinePlayback {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Espelho em ref: o loop de rAF precisa do tempo corrente sem virar
  // dependência do efeito (e sem efeito colateral dentro de um updater,
  // que o StrictMode chamaria duas vezes).
  const timeRef = useRef(0);
  const durationRef = useRef(duration);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  const commit = useCallback((to: number) => { timeRef.current = to; setTime(to); }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const next = timeRef.current + (now - last) / 1000;
      last = now;
      if (next >= durationRef.current) { commit(durationRef.current); setPlaying(false); return; }
      commit(next);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, commit]);

  const seek = useCallback((to: number) => {
    commit(Math.max(0, Math.min(durationRef.current, Number.isFinite(to) ? to : 0)));
  }, [commit]);

  const play = useCallback(() => {
    if (timeRef.current >= durationRef.current - 0.01) commit(0);
    setPlaying(true);
  }, [commit]);

  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => { if (playing) pause(); else play(); }, [playing, play, pause]);

  return { time, playing, play, pause, toggle, seek };
}
