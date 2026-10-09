"use client";
import { useEffect, useRef } from "react";
import { clipFit, clipOpacityAt, isLive, sourceTimeAt, type Timeline, type TimelineClip } from "@/lib/timelineEditor";

/* ============================================================
   Composição ao vivo — camada de PINTURA (DOM empilhado).

   Cada clipe no ar é um <video>/<img> posicionado em porcentagem sobre um
   palco com a proporção da saída; a ordem de empilhamento é a trilha, igual
   ao `overlay` do ffmpeg. O navegador compõe e mistura o áudio sozinho.

   O relógio NÃO mora aqui (useTimelinePlayback.ts) — este componente só
   recebe `time`/`playing` e faz a mídia obedecer. É essa separação que
   permite trocar DOM por canvas depois sem tocar no resto do editor.

   Fidelidade: a prévia imita o render, não o substitui. O `object-fit` de cada
   clipe espelha o enquadramento que o ffmpeg vai aplicar (`clipFit`): cover
   amplia e corta, contain encaixa inteiro, fill estica. O que continua diferente
   é o sincronismo (~1 quadro) e a fonte do texto (navegador ≠ ffmpeg).
   ============================================================ */

/** Quanto a mídia pode derivar do relógio antes de um reseek, em segundos.
    Tocando, folga grande evita engasgo; parado, apertado para o scrub ser fiel. */
const DRIFT_PLAYING = 0.25;
const DRIFT_PAUSED = 0.05;

export default function TimelinePreview({ timeline, time, playing, selectedId, onSelect, onMove }: {
  timeline: Timeline;
  time: number;
  playing: boolean;
  /** Quando `onMove` é passado, o palco vira interativo: clicar seleciona e arrastar reposiciona. */
  selectedId?: string;
  onSelect?: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void;
}) {
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const palco = useRef<HTMLDivElement | null>(null);
  const bgm = useRef<HTMLAudioElement | null>(null);
  const narration = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const drift = playing ? DRIFT_PLAYING : DRIFT_PAUSED;
    const follow = (el: HTMLMediaElement | null, target: number, live: boolean) => {
      if (!el) return;
      if (!live) { if (!el.paused) el.pause(); return; }
      if (!Number.isFinite(target)) return;
      // readyState < HAVE_CURRENT_DATA significa que nenhum quadro foi decodificado
      // ainda — o elemento pinta preto. Um seek com epsilon força a decodificação:
      // reatribuir o mesmo valor que já está em currentTime não dispara seek nenhum.
      const frio = el.readyState < 2;
      if (frio || Math.abs(el.currentTime - target) > drift) el.currentTime = Math.max(0, target) + (frio ? 0.001 : 0);
      if (playing && el.paused) void el.play().catch(() => { /* autoplay negado ou mídia ainda carregando */ });
      if (!playing && !el.paused) el.pause();
    };

    for (const clip of timeline.clips) {
      if (clip.kind !== "video") continue;
      const el = videos.current.get(clip.id);
      if (!el) continue;
      el.muted = !!clip.muted;
      // o volume acompanha o fade, como o afade do render faz (navegador não passa de 1)
      el.volume = Math.max(0, Math.min(1, (clip.volume ?? 1) * clipOpacityAt(clip, time)));
      follow(el, sourceTimeAt(clip, time), isLive(clip, time));
    }

    if (bgm.current) {
      bgm.current.volume = Math.max(0, Math.min(1, timeline.bgmVolume ?? 0.3));
      const loop = bgm.current.duration;
      follow(bgm.current, loop && Number.isFinite(loop) ? time % loop : time, true); // toca a timeline inteira, em loop
    }
    if (narration.current) {
      narration.current.volume = Math.max(0, Math.min(1, timeline.narrationVolume ?? 1));
      follow(narration.current, time, true); // narração começa em 0, igual ao render
    }
  }, [timeline, time, playing]);

  /* Arrastar sobre o palco = mudar x/y, a mesma âncora normalizada que o `overlay`
     do ffmpeg usa. Só existe para onde arrastar quando o clipe não ocupa o quadro
     inteiro: com scale 1 a folga é zero e o arraste não faz nada (por isso um
     sticker nasce pequeno). É assim que um sticker vira "arrastável" sem precisar
     de tipo novo no modelo — ele é um clipe de imagem numa trilha de cima. */
  function arrastar(e: React.PointerEvent<HTMLElement>, clip: TimelineClip) {
    onSelect?.(clip.id);
    const area = palco.current?.getBoundingClientRect();
    const folga = 1 - clip.scale;
    if (!onMove || !area || folga <= 0.001) return;
    e.stopPropagation();
    e.preventDefault();
    const alvo: HTMLElement = e.currentTarget, pointerId = e.pointerId;
    const x0 = e.clientX, y0 = e.clientY, ox = clip.x, oy = clip.y;
    try { alvo.setPointerCapture(pointerId); } catch { /* segue sem captura; os listeners no próprio elemento ainda funcionam */ }
    const limite = (v: number) => Math.max(0, Math.min(1, v));
    function mover(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      onMove!(clip.id, limite(ox + (ev.clientX - x0) / area!.width / folga), limite(oy + (ev.clientY - y0) / area!.height / folga));
    }
    function soltar(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerup", soltar);
      alvo.removeEventListener("pointercancel", soltar);
      try { alvo.releasePointerCapture(pointerId); } catch { /* já liberado */ }
    }
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", soltar);
    alvo.addEventListener("pointercancel", soltar);
  }

  return (
    <div ref={palco} className="tle-stage" style={{ aspectRatio: `${timeline.width} / ${timeline.height}` }}>
      {[...timeline.clips].sort((a, b) => a.track - b.track).map((clip) => {
        const live = isLive(clip, time);
        const box = {
          left: `${(1 - clip.scale) * clip.x * 100}%`,
          top: `${(1 - clip.scale) * clip.y * 100}%`,
          width: `${clip.scale * 100}%`,
          height: `${clip.scale * 100}%`,
          zIndex: clip.track + 1,
          display: live ? undefined : "none",
          objectFit: clipFit(clip), // espelha o fitFilter do compose-multitrack
          opacity: clipOpacityAt(clip, time), // espelha o fade de alpha do render
        };
        const classe = `${onMove && clip.scale < 1 ? "tle-arrastavel" : ""}${selectedId === clip.id ? " tle-alvo" : ""}`.trim() || undefined;
        return clip.kind === "video" ? (
          <video
            key={clip.id}
            ref={(el) => { if (el) videos.current.set(clip.id, el); else videos.current.delete(clip.id); }}
            src={clip.url}
            style={box}
            className={classe}
            onPointerDown={(e) => arrastar(e, clip)}
            preload="auto"
            playsInline
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- mídia local do acervo, sem otimização do next/image
          <img key={clip.id} src={clip.url} alt="" style={box} className={classe} onPointerDown={(e) => arrastar(e, clip)} />
        );
      })}
      {timeline.texts.filter((t) => isLive(t, time)).map((t) => (
        <span
          key={t.id}
          className={`tle-stage-text tle-stage-text-${t.position}`}
          style={{
            color: t.color,
            // fontSize é relativo a uma saída de 1920px de altura (mesma conta do drawtext),
            // então vira fração da altura do palco via unidade de container.
            fontSize: `${(t.fontSize / 1920) * 100}cqh`,
            WebkitTextStrokeWidth: `${(3 / timeline.height) * 100}cqh`,
            textAlign: t.align,
          }}
        >
          {t.text}
        </span>
      ))}
      {timeline.bgmUrl && <audio ref={bgm} src={timeline.bgmUrl} loop preload="metadata" />}
      {timeline.narrationUrl && <audio ref={narration} src={timeline.narrationUrl} preload="metadata" />}
    </div>
  );
}
