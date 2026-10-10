"use client";

/* ============================================================
   CARTÃO DO ACERVO

   Portado das linhas 4880–5288 de `app/gallery/page.tsx`. A
   assinatura de props é a de lá, campo por campo — a troca do
   Maestro é um import e nada mais.

   ── O que a referência dá e o que ela não dá ────────────────
   O bloco 07 (`miora/sections/07-assets`) foi capturado numa
   conta VAZIA: o `INFO.md` diz, na seção "O que ficou
   aproximado", que "não há referência de card, de grade, de
   seleção em lote nem do painel de detalhes — só o vocabulário
   do i18n". Então o cartão NÃO foi copiado de lugar nenhum.
   O que veio da referência é a gramática:

   • movimento — o 07 declara zero keyframe; tudo é
     `transition-colors` de 150 ms. A entrada `galleryItemIn` de
     450 ms que o HeliosGen punha em cada ladrilho foi removida.
   • hover — o cartão do bloco 06 revela o botão "More" só no
     `:hover`/`:focus-within`, em 150 ms. É o mesmo gesto dos
     nossos botões flutuantes.
   • cor — tudo dos tokens. Onde a camada fica sobre MÍDIA (e
     não sobre a superfície do app), a escala é `--ms-whiteA-*` /
     `--ms-blackA-*`, que o kit traz prontas.

   A geometria e os estilos moram em `acervo.css`.
   ============================================================ */

import React, { useEffect, useRef, useState } from "react";
import type { GalleryItem } from "@/lib/galleryUtils";
import {
  cacheDeProporcao,
  definirItemEmArrasto,
  persistirCarregadas,
  urlsCarregadas,
} from "@/components/gallery/estadoMidia";
import "@/components/gallery/cartao.css";

/* ── Miniatura ───────────────────────────────────────────────
   Os mesmos buckets do `deviceSizes`/`imageSizes` do Next, para
   que a URL gerada caia sempre numa largura já cacheada. Ficam
   locais porque o cartão trava a largura ARREDONDADA por URL
   (ver `larguraTravada` abaixo), e o helper de `lib/galleryUtils`
   arredonda por conta própria a partir da largura de exibição. */
const LARGURAS_NEXT = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];

function arredondarLargura(w: number): number {
  const alvo = w * 2;
  return LARGURAS_NEXT.find(s => s >= alvo) ?? LARGURAS_NEXT[LARGURAS_NEXT.length - 1];
}

function urlMiniatura(url: string, arredondada: number): string {
  if (!url || url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("/_next/")) return url;
  return `/_next/image?url=${encodeURIComponent(url)}&w=${arredondada}&q=75`;
}

/* ── Fila de carregamento ────────────────────────────────────
   No máximo 4 imagens da grade descem ao mesmo tempo. É estado
   só do cartão — a página não fala com esta fila —, por isso
   fica aqui e não em `estadoMidia.ts`. */
const FILA_DE_IMAGENS: Array<() => void> = [];
const LIMITE_SIMULTANEO = 4;
let ativas = 0;

function pedirVaga(fn: () => void): () => void {
  if (ativas < LIMITE_SIMULTANEO) { ativas++; fn(); return () => {}; }
  FILA_DE_IMAGENS.push(fn);
  return () => { const i = FILA_DE_IMAGENS.indexOf(fn); if (i !== -1) FILA_DE_IMAGENS.splice(i, 1); };
}

function devolverVaga() {
  ativas = Math.max(0, ativas - 1);
  const proxima = FILA_DE_IMAGENS.shift();
  if (proxima) { ativas++; proxima(); }
}

/* ── Prompt com menções ──────────────────────────────────────
   Troca `<<<image N>>>` pelo chip com a miniatura da referência.
   É gêmeo do `renderLightboxPrompt` do page.tsx, mas a tinta
   diverge de propósito: aqui o texto vive sobre o véu do cartão,
   lá sobre o painel do lightbox. Mantê-los separados evita que
   um ajuste de contraste num lugar estrague o outro. */
function renderPromptComMencoes(texto: string, urlsRef: string[] | undefined): React.ReactNode {
  if (!urlsRef?.length) return texto;

  const partes: React.ReactNode[] = [];
  const re = /<<<image (\d+)>>>/gi;
  let fim = 0;
  let chave = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(texto)) !== null) {
    if (m.index > fim) partes.push(<span key={chave++}>{texto.slice(fim, m.index)}</span>);
    const n = parseInt(m[1]);
    const url = urlsRef[n - 1];
    partes.push(
      <span key={chave++} className="acervo-mencao">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urlMiniatura(url, arredondarLargura(20))} alt="" />
        )}
        Imagem {n}
      </span>,
    );
    fim = m.index + m[0].length;
  }
  if (fim < texto.length) partes.push(<span key={chave++}>{texto.slice(fim)}</span>);
  return <>{partes}</>;
}

export function GalleryCard({
  item,
  displayWidth,
  onOpen,
  onAddReference,
  onCopyPrompt,
  onDownload,
  onDelete,
  videoMuted,
  onToggleMute,
  onNaturalRatioDiscovered,
  selected,
  anySelected,
  onSelect,
  scrollContainer,
  isTagged,
  isNew,
  onMarkSeen,
}: {
  item: GalleryItem;
  displayWidth?: number;
  onOpen?: (thumbUrl: string) => void;
  onAddReference?: (url: string) => void;
  onCopyPrompt?: (prompt: string, refUrls?: string[], meta?: { model?: string; aspectRatio?: string; quality?: string; azureResolution?: string }) => void;
  onDownload?: (url: string, isVideo: boolean) => Promise<void>;
  onDelete?: (id: string, source: "generation" | "upload") => Promise<void>;
  videoMuted?: boolean;
  onToggleMute?: () => void;
  onNaturalRatioDiscovered?: () => void;
  selected?: boolean;
  anySelected?: boolean;
  onSelect?: () => void;
  scrollContainer?: React.RefObject<HTMLDivElement | null>;
  isTagged?: boolean;
  isNew?: boolean;
  onMarkSeen?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cancelarVagaRef = useRef<(() => void) | null>(null);
  const vagaDevolvidaRef = useRef(false);
  /* No original os dois eram `useRef` lidos durante a renderização —
     e o conjunto de miniaturas quebradas ainda precisava de um
     contador só para forçar o re-render. Como estado, o valor é lido
     no lugar certo e o contador some. */
  const [miniaturasQuebradas, setMiniaturasQuebradas] = useState<ReadonlySet<string>>(() => new Set());
  const [larguraPorUrl, setLarguraPorUrl] = useState<Record<string, number>>({});
  const preCarregada = urlsCarregadas.has(item.url);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(preCarregada);
  const [shouldLoad, setShouldLoad] = useState(preCarregada);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cardImgIdx, setCardImgIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const isVideo = item.mediaType === "video";
  const todasAsUrls = item.imageUrls ?? [item.url];
  const urlExibida = todasAsUrls[cardImgIdx] ?? item.url;
  const miniaturaFalhou = miniaturasQuebradas.has(urlExibida);

  /* A largura arredondada é travada por URL e só sobe, nunca desce:
     assim o `resize` da janela não reembaralha a grade nem invalida
     o que já foi baixado. O ajuste é feito na própria renderização —
     o padrão que o React documenta para derivar estado de uma prop —
     e `larguraEstavel` já sai correta nesta passada. */
  const pedida = arredondarLargura(displayWidth ?? 400);
  const travada = larguraPorUrl[urlExibida] ?? 0;
  if (pedida > travada) setLarguraPorUrl(m => ({ ...m, [urlExibida]: pedida }));
  const larguraEstavel = Math.max(pedida, travada);

  // Observador de proximidade: pede vaga na fila quando o cartão chega perto da viewport.
  useEffect(() => {
    if (preCarregada) return;
    const el = cardRef.current;
    if (!el) return;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          if (isVideo) {
            setShouldLoad(true);
          } else if (!cancelarVagaRef.current) {
            cancelarVagaRef.current = pedirVaga(() => setShouldLoad(true));
          }
        }
      },
      { root: scrollContainer?.current ?? null, rootMargin: "200px", threshold: 0 },
    );
    observador.observe(el);
    return () => {
      observador.disconnect();
      cancelarVagaRef.current?.();
      cancelarVagaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Observador de reprodução: só toca o vídeo que está mesmo à vista.
  useEffect(() => {
    if (!isVideo) return;
    const el = cardRef.current;
    if (!el) return;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          videoRef.current?.play().then(() => setPlaying(true)).catch(() => {});
        } else {
          videoRef.current?.pause();
          setPlaying(false);
        }
      },
      { root: scrollContainer?.current ?? null, rootMargin: "0px", threshold: 0.1 },
    );
    observador.observe(el);
    return () => observador.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVideo]);

  /* Só serve para saber se a proporção precisa ser DESCOBERTA no
     `onLoad`. Quem reserva a altura do ladrilho é a grade, em
     page.tsx, lendo `cacheDeProporcao` — o cartão apenas alimenta
     esse cache. (No original havia um `cssRatio` derivado daqui que
     nenhum elemento consumia; não foi portado.) */
  const proporcaoGravada = (() => {
    const ar = item.aspect_ratio;
    if (!ar || ar === "auto") return null;
    const [w, h] = ar.split(":");
    return w && h ? `${w} / ${h}` : null;
  })();

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try { await onDownload?.(item.url, isVideo); } finally { setDownloading(false); }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.prompt) return;
    onCopyPrompt?.(item.prompt, item.referenceImageUrls, { model: item.model, aspectRatio: item.aspect_ratio, quality: item.quality, azureResolution: item.azure_resolution });
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleAddRef = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddReference?.(item.url);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    try { await onDelete?.(item.id, item.source); } finally { setDeleting(false); }
  };

  if (failed) {
    return (
      <div className="gallery-item flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-ms-icon-tertiary" aria-label="Mídia indisponível">
          <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
        </svg>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className={`gallery-item${selected ? " gallery-item--selected" : ""}${anySelected ? " gallery-item--anyselected" : ""}${isTagged ? " gallery-item--tagged" : ""}`}
      draggable
      onDragStart={e => {
        e.stopPropagation();
        definirItemEmArrasto({ url: item.url, mediaType: item.mediaType });
        e.dataTransfer.setData("application/x-gallery-item", "1");
        e.dataTransfer.setData("text/plain", item.url);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onDragEnd={() => definirItemEmArrasto(null)}
      onMouseEnter={() => { setIsHovered(true); onMarkSeen?.(); }}
      onMouseLeave={() => setIsHovered(false)}
      onClick={anySelected ? onSelect : () => onOpen?.(miniaturaFalhou ? urlExibida : urlMiniatura(urlExibida, larguraEstavel))}
    >
      {/* ── Selo de novidade ── */}
      {isNew && <div className="acervo-selo-novo">Novo</div>}

      {/* ── Marca de seleção ── */}
      <div
        className="gallery-checkbox"
        role="checkbox"
        aria-checked={!!selected}
        aria-label="Selecionar item"
        tabIndex={0}
        onClick={e => { e.stopPropagation(); onSelect?.(); }}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onSelect?.(); } }}
      >
        {selected && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-ms-text-on-brand">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </div>

      {isVideo ? (
        <>
          <video
            ref={videoRef}
            src={shouldLoad ? item.url : undefined}
            muted={videoMuted || !isHovered}
            autoPlay
            loop
            playsInline
            preload="metadata"
            draggable={false}
            onLoadedData={() => {
              setImgLoaded(true);
              urlsCarregadas.add(item.url);
            }}
            onError={() => {
              setFailed(true);
              urlsCarregadas.delete(item.url);
              persistirCarregadas();
            }}
            style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 400ms ease" }}
          />
          {!playing && (
            <div className="gallery-play-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--ms-whiteA-12-hex)" stroke="none"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            </div>
          )}
        </>
      ) : (
        <>
          {(!shouldLoad || !imgLoaded) && <div className="gallery-shimmer" />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={urlExibida}
            src={shouldLoad ? (miniaturaFalhou ? urlExibida : urlMiniatura(urlExibida, larguraEstavel)) : undefined}
            alt={item.prompt ?? ""}
            draggable={false}
            decoding="async"
            onLoad={(e) => {
              if (!vagaDevolvidaRef.current) { vagaDevolvidaRef.current = true; devolverVaga(); }
              const img = e.currentTarget;
              if (!proporcaoGravada && item.source === "upload" && img.naturalWidth && img.naturalHeight) {
                const r = `${img.naturalWidth} / ${img.naturalHeight}`;
                if (!cacheDeProporcao.has(item.url)) {
                  cacheDeProporcao.set(item.url, r);
                  onNaturalRatioDiscovered?.();
                }
              }
              setImgLoaded(true);
              urlsCarregadas.add(item.url);
            }}
            onError={() => {
              /* Primeira falha: pode ser só o otimizador do Next. Cai para a
                 URL original antes de declarar o item quebrado. */
              if (!miniaturaFalhou) {
                setMiniaturasQuebradas(prev => new Set(prev).add(urlExibida));
              } else {
                if (!vagaDevolvidaRef.current) { vagaDevolvidaRef.current = true; devolverVaga(); }
                setFailed(true);
                urlsCarregadas.delete(item.url);
                persistirCarregadas();
              }
            }}
            style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 400ms ease" }}
          />

          {/* Navegação do carrossel — só quando o item traz mais de uma imagem. */}
          {todasAsUrls.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Imagem anterior"
                className="acervo-carrossel-seta acervo-carrossel-seta--anterior"
                onClick={e => { e.stopPropagation(); setImgLoaded(false); setCardImgIdx(i => Math.max(0, i - 1)); }}
                disabled={cardImgIdx === 0}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button
                type="button"
                aria-label="Próxima imagem"
                className="acervo-carrossel-seta acervo-carrossel-seta--proxima"
                onClick={e => { e.stopPropagation(); setImgLoaded(false); setCardImgIdx(i => Math.min(todasAsUrls.length - 1, i + 1)); }}
                disabled={cardImgIdx === todasAsUrls.length - 1}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
              <div className="acervo-carrossel-pontos">
                {todasAsUrls.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`Ir para a imagem ${idx + 1}`}
                    aria-current={idx === cardImgIdx}
                    className="acervo-carrossel-ponto"
                    onClick={e => { e.stopPropagation(); setImgLoaded(false); setCardImgIdx(idx); }}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Véu com o prompt ──
          Medido no pior caso — mídia BRANCA sob o véu, que compõe
          rgb(76,76,76). O prompt estava a 72% e a linha de metadados a
          35%: 4,9:1 e 2,7:1. Subiram para `--ms-whiteA-11-hex` (90%,
          7,3:1) e `--ms-whiteA-9-hex` (70%, 5,2:1) — os dois acima de
          4,5:1, com dois degraus de hierarquia preservados. */}
      <div className="gallery-overlay">
        {item.prompt && (
          <div
            className="mb-1 overflow-hidden text-[11px] leading-[1.45]"
            style={{
              color: "var(--ms-whiteA-11-hex)",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
            }}
          >
            {renderPromptComMencoes(item.prompt, item.referenceImageUrls)}
          </div>
        )}
        <p className="text-ms-xs" style={{ color: "var(--ms-whiteA-9-hex)" }}>
          {[item.model, item.aspect_ratio].filter(Boolean).join(" · ") || (item.source === "upload" ? "Enviada" : "")}
        </p>
      </div>

      {/* ── Botões de ação ── */}
      <div className="gallery-actions-top">
        {isVideo && (
          <button
            type="button"
            className="gallery-action-btn"
            onClick={e => { e.stopPropagation(); onToggleMute?.(); }}
            title={videoMuted ? "Ativar som" : "Silenciar"}
            aria-label={videoMuted ? "Ativar som" : "Silenciar"}
          >
            {videoMuted ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
            )}
          </button>
        )}

        {item.prompt && onCopyPrompt && (
          <button
            type="button"
            className="gallery-action-btn"
            title={copied ? "Copiado!" : "Copiar prompt"}
            aria-label={copied ? "Copiado" : "Copiar prompt"}
            onClick={handleCopy}
          >
            {copied ? (
              /* O check da confirmação é o único ponto de marca dentro do
                 véu — é o mesmo violeta do estado marcado da seleção. */
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--brand-solid)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        )}

        <button
          type="button"
          className="gallery-action-btn"
          title={downloading ? "Baixando…" : "Baixar"}
          aria-label={downloading ? "Baixando" : "Baixar"}
          onClick={handleDownload}
          disabled={downloading}
          style={{ opacity: downloading ? 0.65 : undefined }}
        >
          {downloading ? (
            <span className="acervo-giro acervo-giro--claro" style={{ width: 11, height: 11, borderWidth: 2 }} />
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
        </button>

        {onDelete && (
          <button
            type="button"
            className="gallery-action-btn gallery-delete-btn"
            title="Excluir"
            aria-label="Excluir"
            onClick={handleDelete}
            disabled={deleting}
            style={{ opacity: deleting ? 0.65 : undefined }}
          >
            {deleting ? (
              <span className="acervo-giro acervo-giro--claro" style={{ width: 11, height: 11, borderWidth: 2 }} />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* ── Usar como referência — só imagem ── */}
      {!isVideo && onAddReference && (
        <div className="gallery-actions-bottom">
          <button type="button" className="gallery-ref-btn" onClick={handleAddRef}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
            </svg>
            Referência
          </button>
        </div>
      )}
    </div>
  );
}
