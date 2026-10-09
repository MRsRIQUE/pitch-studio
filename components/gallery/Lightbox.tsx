"use client";

/* ============================================================
   LIGHTBOX DO ACERVO

   Portado de `app/gallery/page.tsx` (a faixa que continha
   `syntaxHighlightJson`, `syntaxHighlightYaml`, `colorYamlValue`,
   `renderLightboxPrompt` e `Lightbox`). A assinatura de props saiu
   idêntica à de lá, de propósito: a troca é um import e nada mais.

   O que mudou foi só a pele. A faixa original tinha 31 ocorrências
   de branco em alfa e um painel quase preto — resíduo escuro
   do HeliosGen. A decisão de véu e a paleta nova de sintaxe estão
   medidas e justificadas em `./lightbox.css`; o resumo é: o véu
   fica (a referência escurece o fundo de visualizador de mídia em
   dois lugares independentes) e o painel de leitura volta a ser
   superfície clara, como o modal da referência.

   Os três realçadores de sintaxe (`syntaxHighlightJson`,
   `syntaxHighlightYaml` e o `splitByMentions` de que dependem)
   moram aqui porque estavam na faixa portada, mas quem os consome
   hoje é o composer, não o lightbox. Ficam exportados para que o
   `page.tsx` possa importá-los daqui e apagar a cópia local.
   ============================================================ */

import * as React from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { thumbSrc, type GalleryItem } from "@/lib/galleryUtils";
import type { TaggedImage } from "@/components/gallery/tipos";

import "./lightbox.css";

/* ── Menções `@` dentro do texto realçado ────────────────────
   Quebra um trecho nos rótulos das mídias citadas e devolve os
   pedaços já embrulhados. O parâmetro de cor virou classe: a
   paleta agora mora no CSS, não em `style`. */
export function splitByMentions(
  text: string,
  baseClass: string | undefined,
  tagged: TaggedImage[],
  keyStart: number,
  onEnter: (tag: TaggedImage, rect: DOMRect) => void,
  onLeave: () => void,
  onMouseDown: (tag: TaggedImage) => void,
): { nodes: React.ReactNode[]; nextKey: number } {
  if (!tagged.length) {
    return {
      nodes: [<span key={keyStart} className={baseClass}>{text}</span>],
      nextKey: keyStart + 1,
    };
  }
  // Rótulo mais longo primeiro: "@gato preto" não pode ser comido por "@gato".
  const sorted = [...tagged].sort((a, b) => b.label.length - a.label.length);
  const nodes: React.ReactNode[] = [];
  let k = keyStart;
  let rest = text;
  while (rest.length > 0) {
    let earliest: { idx: number; tag: TaggedImage } | null = null;
    for (const tag of sorted) {
      const idx = rest.indexOf(`@${tag.label}`);
      if (idx !== -1 && (earliest === null || idx < earliest.idx)) earliest = { idx, tag };
    }
    if (!earliest) {
      nodes.push(<span key={k++} className={baseClass}>{rest}</span>);
      break;
    }
    if (earliest.idx > 0) {
      nodes.push(<span key={k++} className={baseClass}>{rest.slice(0, earliest.idx)}</span>);
    }
    const tag = earliest.tag;
    nodes.push(
      <span
        key={k++}
        className="lb-mencao"
        onMouseEnter={e => onEnter(tag, e.currentTarget.getBoundingClientRect())}
        onMouseLeave={onLeave}
        onMouseDown={e => { e.preventDefault(); onMouseDown(tag); }}
      >
        @{tag.label}
      </span>,
    );
    rest = rest.slice(earliest.idx + tag.label.length + 1);
  }
  return { nodes, nextKey: k };
}

/* ── Realce de JSON ──────────────────────────────────────────*/
export function syntaxHighlightJson(
  json: string,
  tagged?: TaggedImage[],
  onEnter?: (tag: TaggedImage, rect: DOMRect) => void,
  onLeave?: () => void,
  onMD?: (tag: TaggedImage) => void,
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let k = 0;
  const push = (from: number, to: number, cls?: string) => {
    if (from >= to) return;
    const text = json.slice(from, to);
    if (tagged?.length && onEnter && onLeave && onMD) {
      const { nodes, nextKey } = splitByMentions(text, cls, tagged, k, onEnter, onLeave, onMD);
      parts.push(...nodes);
      k = nextKey;
    } else {
      parts.push(<span key={k++} className={cls}>{text}</span>);
    }
  };
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(true|false|null)|([{}[\],])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(json)) !== null) {
    push(last, m.index);
    if (m[1] !== undefined) {
      if (m[2] !== undefined) {
        push(m.index, m.index + m[1].length, "lb-json-chave");
        push(m.index + m[1].length, m.index + m[0].length, "lb-json-pont");
      } else {
        push(m.index, m.index + m[1].length, "lb-json-texto");
      }
    } else if (m[3] !== undefined) {
      push(m.index, m.index + m[3].length, "lb-json-numero");
    } else if (m[4] !== undefined) {
      push(m.index, m.index + m[4].length, "lb-json-bool");
    } else if (m[5] !== undefined) {
      push(m.index, m.index + m[5].length, "lb-json-pont");
    }
    last = re.lastIndex;
  }
  push(last, json.length);
  return <>{parts}</>;
}

/* ── Realce de YAML ──────────────────────────────────────────*/
export function syntaxHighlightYaml(
  yaml: string,
  tagged?: TaggedImage[],
  onEnter?: (tag: TaggedImage, rect: DOMRect) => void,
  onLeave?: () => void,
  onMD?: (tag: TaggedImage) => void,
): React.ReactNode {
  const lines = yaml.split("\n");
  const parts: React.ReactNode[] = [];
  let k = 0;
  lines.forEach((line, i) => {
    // Marcadores de diretiva e de documento
    if (/^---/.test(line) || /^\.\.\.$/.test(line)) {
      parts.push(<span key={k++} className="lb-json-pont">{line}</span>);
    } else {
      // chave: valor (aceita indentação e marcador de lista antes)
      const keyMatch = line.match(/^(\s*(?:-\s+)?)([\w\-./]+)(\s*:)(.*)/);
      if (keyMatch) {
        const [, indent, key, colon, rest] = keyMatch;
        parts.push(<span key={k++}>{indent}</span>);
        parts.push(<span key={k++} className="lb-json-chave">{key}</span>);
        parts.push(<span key={k++} className="lb-json-pont">{colon}</span>);
        parts.push(<span key={k++}>{colorYamlValue(rest, k, tagged, onEnter, onLeave, onMD)}</span>);
        k++;
      } else {
        // Item de lista ou valor solto
        const listMatch = line.match(/^(\s*-\s+)(.*)/);
        if (listMatch) {
          parts.push(<span key={k++} className="lb-json-pont">{listMatch[1]}</span>);
          parts.push(<span key={k++}>{colorYamlValue(listMatch[2], k, tagged, onEnter, onLeave, onMD)}</span>);
          k++;
        } else if (tagged?.length && onEnter && onLeave && onMD) {
          const { nodes, nextKey } = splitByMentions(line, undefined, tagged, k, onEnter, onLeave, onMD);
          parts.push(...nodes);
          k = nextKey;
        } else {
          parts.push(<span key={k++}>{line}</span>);
        }
      }
    }
    if (i < lines.length - 1) parts.push(<span key={k++}>{"\n"}</span>);
  });
  return <>{parts}</>;
}

function colorYamlValue(
  value: string,
  baseKey: number,
  tagged?: TaggedImage[],
  onEnter?: (tag: TaggedImage, rect: DOMRect) => void,
  onLeave?: () => void,
  onMD?: (tag: TaggedImage) => void,
): React.ReactNode {
  // Comentário na mesma linha
  const commentIdx = value.search(/#/);
  const main = commentIdx >= 0 ? value.slice(0, commentIdx) : value;
  const comment = commentIdx >= 0 ? value.slice(commentIdx) : "";
  let k = baseKey * 100;
  const out: React.ReactNode[] = [];
  const trimmed = main.trim();

  const pushValue = (text: string, cls?: string) => {
    if (tagged?.length && onEnter && onLeave && onMD) {
      const { nodes, nextKey } = splitByMentions(text, cls, tagged, k, onEnter, onLeave, onMD);
      out.push(...nodes);
      k = nextKey;
    } else {
      out.push(<span key={k++} className={cls}>{text}</span>);
    }
  };

  if (/^(true|false|yes|no|on|off)$/i.test(trimmed)) {
    pushValue(main, "lb-json-bool");
  } else if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed) || /^0x[\da-fA-F]+$/.test(trimmed)) {
    pushValue(main, "lb-json-numero");
  } else if (/^(null|~)$/.test(trimmed)) {
    pushValue(main, "lb-json-bool");
  } else if (/^['"]/.test(trimmed)) {
    pushValue(main, "lb-json-texto");
  } else if (trimmed !== "") {
    pushValue(main, "lb-json-plano");
  } else {
    pushValue(main);
  }
  if (comment) out.push(<span key={k++} className="lb-json-pont">{comment}</span>);
  return <>{out}</>;
}

/* ── Prompt do lightbox ──────────────────────────────────────
   Troca os marcadores `<<<image N>>>` por um chip com a miniatura
   da referência correspondente. */
export function renderLightboxPrompt(
  text: string,
  refUrls: string[] | undefined,
): React.ReactNode {
  if (!refUrls?.length) return <span>{text}</span>;

  const parts: React.ReactNode[] = [];
  let lastEnd = 0;
  let key = 0;
  const re = /<<<image (\d+)>>>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastEnd) {
      parts.push(<span key={key++}>{text.slice(lastEnd, m.index)}</span>);
    }
    const n = parseInt(m[1], 10);
    const imgUrl = refUrls[n - 1];
    parts.push(
      <span key={key++} className="lb-mencao-imagem">
        {imgUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbSrc(imgUrl, 20)} alt="" />
        )}
        Imagem {n}
      </span>,
    );
    lastEnd = m.index + m[0].length;
  }
  if (lastEnd < text.length) parts.push(<span key={key++}>{text.slice(lastEnd)}</span>);
  return <>{parts}</>;
}

/* ── Ícones ──────────────────────────────────────────────────
   Traço em `currentColor` para herdar a cor de cada contexto (o
   chrome sobre a mídia é claro, o painel é escuro sobre branco). */
function IconeSeta({ sentido }: { sentido: "anterior" | "proxima" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points={sentido === "anterior" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
    </svg>
  );
}

function IconeFechar() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function IconePrompt() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3h6l-1 5H3z" /><path d="M3 8h6M7 3v5" /><path d="M14 3h7" /><path d="M14 8h7" />
      <path d="M14 13h4" /><path d="M3 13h8" /><path d="M3 18h18" />
    </svg>
  );
}

function IconeInfo() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function IconeBaixar() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v13M7 13l5 5 5-5" /><path d="M5 21h14" />
    </svg>
  );
}

/* ── Lightbox ────────────────────────────────────────────────*/
export function Lightbox({ item, thumbUrl, onClose, onCopyPrompt, onPrev, onNext }: { item: GalleryItem; thumbUrl?: string; onClose: () => void; onCopyPrompt?: (prompt: string, refUrls?: string[], meta?: { model?: string; aspectRatio?: string; quality?: string; azureResolution?: string }) => void; onPrev?: () => void; onNext?: () => void }) {
  const [visible, setVisible] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [placeholderSrc, setPlaceholderSrc] = useState(thumbUrl ?? "");
  const [zoomed, setZoomed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [resolution, setResolution] = useState<string | null>(null);
  const allUrls = item.imageUrls ?? [item.url];
  const lightboxUrl = allUrls[imgIdx] ?? item.url;

  /* Trocar de item (ou de cartaz) zera o folheado. O ajuste é feito
     durante a renderização, e não num efeito: é o caminho que o React
     recomenda para estado derivado de prop, e evita o quadro
     intermediário em que o índice antigo aponta para a mídia nova.
     No original isto era um `useEffect`, que o lint barra. */
  const chaveItem = `${item.id}|${thumbUrl ?? ""}`;
  const [chaveVista, setChaveVista] = useState(chaveItem);
  if (chaveVista !== chaveItem) {
    setChaveVista(chaveItem);
    setImgIdx(0);
    setFullLoaded(false);
    setResolution(null);
    setPlaceholderSrc(thumbUrl ?? "");
  }

  useEffect(() => { const id = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(id); }, []);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 200); };

  /* Folhear dentro de um item com várias imagens. O cartaz sai do cache
     do navegador na mesma ação que mexe no índice — no original isso
     vinha de um efeito que só disparava com `imgIdx > 0`, e por isso
     voltar para a primeira imagem deixava o cartaz da anterior na tela. */
  const irPara = (idx: number) => {
    const alvo = Math.min(Math.max(idx, 0), allUrls.length - 1);
    setImgIdx(alvo);
    setFullLoaded(false);
    setResolution(null);
    setPlaceholderSrc(alvo > 0 ? thumbSrc(allUrls[alvo] ?? item.url, 300) : (thumbUrl ?? ""));
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (zoomed) { setZoomed(false); return; } handleClose(); return; }
      if (e.key === "ArrowLeft") {
        if (imgIdx > 0) irPara(imgIdx - 1);
        else onPrev?.();
      }
      if (e.key === "ArrowRight") {
        if (imgIdx < allUrls.length - 1) irPara(imgIdx + 1);
        else onNext?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUrls.length, imgIdx, zoomed, onPrev, onNext]);

  const isVideo = item.mediaType === "video";

  const copyPrompt = () => {
    if (!item.prompt) return;
    if (onCopyPrompt) {
      onCopyPrompt(item.prompt, item.referenceImageUrls, { model: item.model, aspectRatio: item.aspect_ratio, quality: item.quality, azureResolution: item.azure_resolution });
    } else {
      navigator.clipboard.writeText(item.prompt).catch(() => { });
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const urlExt = lightboxUrl.split("?")[0].split(".").pop()?.toLowerCase();
      const ext = isVideo ? "mp4" : (urlExt && ["png", "jpg", "jpeg", "webp", "gif"].includes(urlExt) ? urlExt : "png");
      const filename = `${isVideo ? "video" : "image"}-${item.id.slice(0, 8)}.${ext}`;
      const res = await fetch(`/api/download?url=${encodeURIComponent(lightboxUrl)}&filename=${filename}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDownloading(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

  const infoRows = [
    item.model && { label: "Modelo", value: item.model },
    item.quality && { label: "Qualidade", value: item.quality.charAt(0).toUpperCase() + item.quality.slice(1) },
    item.aspect_ratio && { label: "Proporção", value: item.aspect_ratio },
    resolution && { label: "Resolução", value: resolution },
    item.source && { label: "Origem", value: item.source === "generation" ? "Gerada" : "Enviada" },
    { label: "Criada em", value: formatDate(item.created_at) },
  ].filter(Boolean) as { label: string; value: string }[];

  const podeFolhear = !isVideo && allUrls.length > 1;
  const larguraPainel = 300;

  return createPortal(
    <div
      className="lb-veu"
      data-visivel={visible}
      data-ampliado={zoomed}
      onClick={zoomed ? () => setZoomed(false) : handleClose}
    >
      {/* ── Coluna da mídia ── */}
      <div className="lb-coluna-midia">

        {podeFolhear && (
          <button
            type="button"
            aria-label="Imagem anterior"
            className="lb-chrome lb-nav lb-nav-anterior"
            onClick={e => { e.stopPropagation(); irPara(imgIdx - 1); }}
            disabled={imgIdx === 0}
          >
            <IconeSeta sentido="anterior" />
          </button>
        )}

        {/* Clicar na mídia alterna o modo ampliado */}
        <div
          className="lb-midia"
          data-video={isVideo}
          onClick={e => { e.stopPropagation(); if (!isVideo) setZoomed(z => !z); }}
          style={{
            maxWidth: zoomed ? "none" : "100%",
            maxHeight: zoomed ? "none" : "calc(100vh - 48px)",
            transform: visible ? "scale(1)" : "scale(0.96)",
            cursor: isVideo ? "default" : (zoomed ? "zoom-out" : "zoom-in"),
          }}
        >
          {isVideo ? (
            <video
              key={lightboxUrl}
              src={lightboxUrl}
              autoPlay
              loop
              playsInline
              controls
              onClick={e => e.stopPropagation()}
              onLoadedData={e => { setFullLoaded(true); const v = e.currentTarget; if (v.videoWidth && v.videoHeight) setResolution(`${v.videoWidth} × ${v.videoHeight}`); }}
              style={{
                display: "block",
                maxHeight: "100vh",
                maxWidth: "100vw",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                borderRadius: zoomed ? 0 : "var(--ms-radius-lg)",
                cursor: "default",
              }}
            />
          ) : (
            <>
              {/* Cartaz: a miniatura já está no cache do navegador, pinta na hora */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={`thumb-${lightboxUrl}`}
                src={placeholderSrc}
                alt=""
                aria-hidden
                style={{
                  display: "block",
                  maxHeight: zoomed ? "100vh" : "calc(100vh - 48px)",
                  maxWidth: zoomed ? "100vw" : "100%",
                  width: "auto",
                  height: "auto",
                  opacity: fullLoaded ? 0 : 1,
                  transition: "opacity 400ms ease",
                }}
              />
              {/* Resolução plena por cima, sem fade: o navegador pinta linha a linha */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={`full-${lightboxUrl}`}
                src={lightboxUrl}
                alt={item.prompt ?? ""}
                onLoad={e => { setFullLoaded(true); const img = e.currentTarget; if (img.naturalWidth && img.naturalHeight) setResolution(`${img.naturalWidth} × ${img.naturalHeight}`); }}
                style={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", objectFit: "contain" }}
              />
              {allUrls.length > 1 && (
                <div className="lb-paginacao">
                  {allUrls.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      aria-label={`Ir para a imagem ${idx + 1}`}
                      aria-current={idx === imgIdx}
                      className="lb-ponto"
                      data-ativo={idx === imgIdx}
                      onClick={e => { e.stopPropagation(); irPara(idx); }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {podeFolhear && (
          <button
            type="button"
            aria-label="Próxima imagem"
            className="lb-chrome lb-nav lb-nav-proxima"
            onClick={e => { e.stopPropagation(); irPara(imgIdx + 1); }}
            disabled={imgIdx === allUrls.length - 1}
          >
            <IconeSeta sentido="proxima" />
          </button>
        )}
      </div>

      {/* ── Painel de informação ── */}
      <div
        className="lb-painel"
        onClick={e => e.stopPropagation()}
        style={{
          opacity: zoomed ? 0 : visible ? 1 : 0,
          transform: zoomed
            ? `translateX(${larguraPainel + 20}px)`
            : visible ? "translateX(0)" : "translateX(14px)",
          pointerEvents: zoomed ? "none" : "auto",
        }}
      >
        {item.prompt && (
          <section className="lb-secao">
            {item.referenceImageUrls && item.referenceImageUrls.length > 0 && (
              <div className="lb-referencias">
                {item.referenceImageUrls.map((url, i) => (
                  <div key={i} className="lb-referencia">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbSrc(url, 76)} alt="" />
                    <div className="lb-referencia-indice">{i + 1}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="lb-secao-cabecalho" style={{ justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--ms-icon-tertiary)" }}>
                <IconePrompt />
                <span className="lb-secao-rotulo">Prompt</span>
              </div>
              <button
                type="button"
                className="lb-botao lb-botao-copiar"
                data-copiado={copied}
                onClick={copyPrompt}
              >
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
            <div className="lb-prompt">
              {renderLightboxPrompt(item.prompt, item.referenceImageUrls)}
            </div>
          </section>
        )}

        <section className="lb-secao">
          <div className="lb-secao-cabecalho" style={{ color: "var(--ms-icon-tertiary)" }}>
            <IconeInfo />
            <span className="lb-secao-rotulo">Informações</span>
          </div>
          {infoRows.map(row => (
            <div key={row.label} className="lb-linha">
              <span className="lb-linha-rotulo">{row.label}</span>
              <span className="lb-linha-valor">{row.value}</span>
            </div>
          ))}
        </section>

        <button
          type="button"
          className="lb-botao lb-botao-baixar"
          onClick={download}
          disabled={downloading}
        >
          {downloading ? <span className="lb-giro-baixar" /> : <IconeBaixar />}
          {downloading ? "Baixando…" : "Baixar"}
        </button>
      </div>

      {/* ── Fechar ── */}
      <button
        type="button"
        aria-label="Fechar"
        className="lb-chrome lb-fechar"
        onClick={handleClose}
        style={{ opacity: visible ? 1 : 0 }}
      >
        <IconeFechar />
      </button>
    </div>,
    document.body,
  );
}
