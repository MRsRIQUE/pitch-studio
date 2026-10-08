"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GalleryItem, galleryCache, getToken, thumbSrc } from "@/lib/galleryUtils";
import "./superficies.css";

type TabId = "uploads" | "image-gen" | "video-gen";

/* O esqueleto e o giro moraram aqui; agora são `.ms-esqueleto` e
   `.ms-giro` em `superficies.css`, com as cores do kit. */

const PICKER_POS_STORAGE_KEY = "mediaPickerModal:pos";

function loadSavedPickerPos(): { left: number; top: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PICKER_POS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.left === "number" && typeof parsed?.top === "number") return parsed;
  } catch {
    // ignore malformed storage
  }
  return null;
}

function savePickerPos(left: number, top: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PICKER_POS_STORAGE_KEY, JSON.stringify({ left, top }));
  } catch {
    // ignore storage failures (e.g. private browsing quota)
  }
}

function PickerImage({ src }: { src: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const thumbUrl = thumbSrc(src);
  return (
    <div className="absolute inset-0">
      {status === "loading" && (
        <div className="ms-esqueleto absolute inset-0" />
      )}
      {status !== "error" && (
        <img
          alt=""
          src={thumbUrl}
          loading="lazy"
          decoding="async"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
            opacity: status === "loaded" ? 1 : 0,
            transition: "opacity 180ms ease",
          }}
        />
      )}
    </div>
  );
}

function mergeByNewest(prev: GalleryItem[], incoming: GalleryItem[]): GalleryItem[] {
  const seen = new Set(prev.map(i => i.id));
  const brandNew = incoming.filter(i => !seen.has(i.id));
  if (brandNew.length === 0) return prev;
  return [...prev, ...brandNew].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function MediaPickerModal({
  open,
  mediaKind,
  onClose,
  onPickUrl,
  onDeselect,
  onUpload,
  anchorRef,
  x,
  y,
  selectedUrls,
  maxCount,
}: {
  open: boolean;
  mediaKind: "image" | "video" | "any";
  onClose: () => void;
  onPickUrl: (url: string, mediaType: "image" | "video") => void;
  onDeselect?: (url: string) => void;
  onUpload?: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  x?: number;
  y?: number;
  selectedUrls?: string[];
  maxCount?: number;
}) {
  const defaultTab: TabId = mediaKind === "image" ? "image-gen" : mediaKind === "video" ? "video-gen" : "uploads";
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const [sourceItems, setSourceItems] = useState<GalleryItem[]>([]);
  const [fetching, setFetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const imagePageRef = useRef(0);
  const videoPageRef = useRef(0);
  const imageHasMoreRef = useRef(true);
  const videoHasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const activeTabRef = useRef<TabId>(defaultTab);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0, bottom: 0, width: 0, isAnchored: false, isCustom: false });
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<GalleryItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!pos.isCustom) return;
    if ((e.target as HTMLElement).closest("button, input")) return;
    dragOffsetRef.current = { x: e.clientX - pos.left, y: e.clientY - pos.top };
    setIsDragging(true);
    e.preventDefault();
  }, [pos.isCustom, pos.left, pos.top]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => {
      setPos((p) => ({
        ...p,
        left: Math.max(4, Math.min(e.clientX - dragOffsetRef.current.x, window.innerWidth - p.width - 4)),
        top: Math.max(4, Math.min(e.clientY - dragOffsetRef.current.y, window.innerHeight - p.width - 4)),
      }));
    };
    const handleUp = () => {
      setIsDragging(false);
      setPos((p) => {
        savePickerPos(p.left, p.top);
        return p;
      });
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDragging]);

  const submitUrl = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed || urlLoading) return;
    setUrlError("");
    setUrlLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/fetch-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json() as { cdnUrl?: string; mediaType?: "image" | "video"; error?: string };
      if (!res.ok || !data.cdnUrl) throw new Error(data.error ?? "Não consegui buscar esse endereço.");
      setUrlInput("");
      onPickUrl(data.cdnUrl, data.mediaType ?? "image");
      onClose();
    } catch (e: unknown) {
      setUrlError(e instanceof Error ? e.message : "Não consegui buscar esse endereço.");
    } finally {
      setUrlLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    let targetLeft = 0;
    let targetTop = 0;
    let targetBottom = 0;
    let targetWidth = 0;
    let anchored = false;
    let custom = false;

    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      targetLeft = rect.left;
      targetBottom = window.innerHeight - rect.top + 6;
      targetWidth = rect.width;
      // Clamp so the modal never overflows the top of the viewport
      const modalH = 88 + 0.25 * (targetWidth - 64);
      targetBottom = Math.min(targetBottom, window.innerHeight - modalH - 8);
      targetBottom = Math.max(targetBottom, 8);
      anchored = true;
    } else if (x !== undefined && y !== undefined) {
      // Position at cursor — square popup (or the remembered spot, if the user moved it before)
      const modalSize = 520;
      const saved = loadSavedPickerPos();
      const rawLeft = saved ? saved.left : x;
      const rawTop = saved ? saved.top : y;
      targetLeft = Math.max(12, Math.min(rawLeft, window.innerWidth - modalSize - 12));
      targetTop = Math.max(12, Math.min(rawTop, window.innerHeight - modalSize - 12));
      targetWidth = modalSize;
      custom = true;
    }

    setPos({
      left: targetLeft,
      top: targetTop,
      bottom: targetBottom,
      width: targetWidth,
      isAnchored: anchored,
      isCustom: custom,
    });
  }, [open, anchorRef, x, y]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    const needsImg = (mediaKind === "image" || mediaKind === "any") && imageHasMoreRef.current;
    const needsVid = (mediaKind === "video" || mediaKind === "any") && videoHasMoreRef.current;
    if (!needsImg && !needsVid) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const token = await getToken();
      if (!token) return;
      const fetches: Promise<void>[] = [];
      if (needsImg) {
        const nextPage = imagePageRef.current + 1;
        fetches.push(
          fetch(`/api/gallery?type=image&page=${nextPage}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() as Promise<{ items: GalleryItem[]; hasMore: boolean }> : null)
            .then(data => {
              if (!data) return;
              imageHasMoreRef.current = data.hasMore;
              imagePageRef.current = nextPage;
              setSourceItems(prev => mergeByNewest(prev, data.items));
            })
        );
      }
      if (needsVid) {
        const nextPage = videoPageRef.current + 1;
        fetches.push(
          fetch(`/api/gallery?type=video&page=${nextPage}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() as Promise<{ items: GalleryItem[]; hasMore: boolean }> : null)
            .then(data => {
              if (!data) return;
              videoHasMoreRef.current = data.hasMore;
              videoPageRef.current = nextPage;
              setSourceItems(prev => mergeByNewest(prev, data.items));
            })
        );
      }
      await Promise.all(fetches);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [mediaKind]);

  useEffect(() => {
    if (!open) { setUrlInput(""); setUrlError(""); setPreviewItem(null); return; }
    setActiveTab(defaultTab);
    activeTabRef.current = defaultTab;

    // Reset pagination
    imagePageRef.current = 0;
    videoPageRef.current = 0;
    imageHasMoreRef.current = true;
    videoHasMoreRef.current = true;
    loadingMoreRef.current = false;

    if (mediaKind === "any") {
      const cached = [
        ...(galleryCache.get("images-generation")?.items ?? []),
        ...(galleryCache.get("images-upload")?.items ?? []),
        ...(galleryCache.get("videos-generation")?.items ?? []),
        ...(galleryCache.get("videos-upload")?.items ?? []),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setSourceItems(cached);
    } else {
      const tab = mediaKind === "image" ? "images" : "videos";
      const cached = [
        ...(galleryCache.get(`${tab}-generation`)?.items ?? []),
        ...(galleryCache.get(`${tab}-upload`)?.items ?? []),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setSourceItems(cached);
    }

    setFetching(true);
    (async () => {
      const token = await getToken();
      if (!token) { setFetching(false); return; }

      if (mediaKind === "any") {
        const [imgRes, vidRes] = await Promise.all([
          fetch("/api/gallery?type=image&page=0", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/gallery?type=video&page=0", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const [imgData, vidData] = await Promise.all([
          imgRes.ok ? (imgRes.json() as Promise<{ items: GalleryItem[]; hasMore: boolean }>) : Promise.resolve({ items: [] as GalleryItem[], hasMore: false }),
          vidRes.ok ? (vidRes.json() as Promise<{ items: GalleryItem[]; hasMore: boolean }>) : Promise.resolve({ items: [] as GalleryItem[], hasMore: false }),
        ]);
        imageHasMoreRef.current = imgData.hasMore;
        videoHasMoreRef.current = vidData.hasMore;
        setSourceItems(prev => mergeByNewest(prev, [...imgData.items, ...vidData.items]));
      } else {
        const res = await fetch(`/api/gallery?type=${mediaKind}&page=0`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json() as { items: GalleryItem[]; hasMore: boolean };
          if (mediaKind === "image") imageHasMoreRef.current = data.hasMore;
          else videoHasMoreRef.current = data.hasMore;
          setSourceItems(prev => mergeByNewest(prev, data.items));
        }
      }
      setFetching(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mediaKind]);

  // Keep activeTabRef in sync
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // Infinite scroll for the picker
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !open) return;

    const checkAndLoad = () => {
      if (loadingMoreRef.current) return;
      const needsImg = (mediaKind === "image" || mediaKind === "any") && imageHasMoreRef.current;
      const needsVid = (mediaKind === "video" || mediaKind === "any") && videoHasMoreRef.current;
      if (!needsImg && !needsVid) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
        loadMore();
      }
    };

    el.addEventListener("scroll", checkAndLoad, { passive: true });
    return () => el.removeEventListener("scroll", checkAndLoad);
  }, [open, mediaKind, loadMore, loadingMore]);

  const displayItems = useMemo(() => {
    if (activeTab === "uploads")   return sourceItems.filter((i) => i.source === "upload");
    if (activeTab === "image-gen") return sourceItems.filter((i) => i.source === "generation" && i.mediaType === "image");
    return sourceItems.filter((i) => i.source === "generation" && i.mediaType === "video");
  }, [activeTab, sourceItems]);

  useEffect(() => {
    if (!previewItem) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const idx = displayItems.findIndex(i => i.id === previewItem.id);
        if (idx === -1) return;
        const nextIdx = e.key === "ArrowLeft" ? idx - 1 : idx + 1;
        if (nextIdx >= 0 && nextIdx < displayItems.length) setPreviewItem(displayItems[nextIdx]);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const isSelected = selectedUrls?.includes(previewItem.url) ?? false;
        const atLimit = maxCount !== undefined && (selectedUrls?.length ?? 0) >= maxCount;
        if (isSelected) {
          onDeselect?.(previewItem.url);
        } else if (!atLimit) {
          onPickUrl(previewItem.url, previewItem.mediaType);
        }
        setPreviewItem(null);
      } else if (e.key === "Escape") {
        setPreviewItem(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [previewItem, displayItems, selectedUrls, maxCount, onPickUrl, onDeselect]);

  if (!open) return null;

  // Build tab list based on mediaKind
  const tabs: { id: TabId; label: string }[] =
    mediaKind === "any"
      ? [
          { id: "uploads",   label: "Enviadas" },
          { id: "image-gen", label: "Imagens geradas" },
          { id: "video-gen", label: "Vídeos gerados" },
        ]
      : mediaKind === "image"
      ? [
          { id: "image-gen", label: "Imagens geradas" },
          { id: "uploads",   label: "Enviadas" },
        ]
      : [
          { id: "video-gen", label: "Vídeos gerados" },
          { id: "uploads",   label: "Enviadas" },
        ];

  const modal = createPortal(
    <div data-prompt-overlay="" style={{ position: "fixed", inset: 0, zIndex: 100000, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}
      />
      <div style={{
        position: "fixed",
        left: (pos.isAnchored || pos.isCustom) ? pos.left : "50%",
        top: pos.isCustom ? pos.top : (pos.isAnchored ? "auto" : "50%"),
        bottom: pos.isAnchored ? pos.bottom : (pos.isCustom ? "auto" : "auto"),
        transform: (pos.isAnchored || pos.isCustom) ? "none" : "translate(-50%, -50%)",
        width: (pos.isAnchored || pos.isCustom) ? pos.width : "min(660px, calc(100vw - 32px))",
        height: pos.isCustom ? `${pos.width}px` : pos.isAnchored ? `${88 + 0.25 * (pos.width - 64)}px` : "520px",
        display: "flex",
        flexDirection: "column",
        pointerEvents: "auto",
      }}
      className="ms-superficie-entrada-baixo overflow-hidden rounded-ms-xl border border-ms-border-subtle bg-ms-bg shadow-ms-lg"
      >
        {/* Tab bar */}
        <div
          onMouseDown={handleDragStart}
          className="flex shrink-0 items-center gap-1 border-b border-ms-border-subtle px-[18px] pb-3 pt-3.5"
          style={{ cursor: pos.isCustom ? (isDragging ? "grabbing" : "grab") : "default" }}
        >
          {tabs.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={
                  "cursor-pointer rounded-ms-full border-none px-4 py-1.5 text-ms-md transition-colors duration-150 " +
                  (active
                    ? "bg-ms-solid-brand font-medium text-ms-text-on-solid"
                    : "bg-transparent text-ms-text-secondary hover:bg-ms-bg-hover hover:text-ms-text")
                }
              >
                {t.label}
              </button>
            );
          })}
          {maxCount !== undefined && (
            <span
              className={
                "ml-2 shrink-0 rounded-ms-full px-2 py-[3px] text-ms-sm font-medium " +
                ((selectedUrls?.length ?? 0) >= maxCount
                  ? "bg-ms-bg-brand text-ms-text-brand"
                  : "bg-ms-bg-component text-ms-text-tertiary")
              }
            >
              {selectedUrls?.length ?? 0}/{maxCount}
            </span>
          )}
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-ms-full border-none bg-ms-bg-component text-ms-icon-secondary transition-colors duration-150 hover:bg-ms-bg-component-active hover:text-ms-text"
            style={{ marginLeft: maxCount !== undefined ? "4px" : "auto" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* URL input bar */}
        <div className="shrink-0 border-b border-ms-border-subtle px-[18px] py-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="url"
                placeholder="Cole o endereço de uma imagem…"
                value={urlInput}
                onChange={e => { setUrlInput(e.target.value); setUrlError(""); }}
                onKeyDown={e => { if (e.key === "Enter") submitUrl(); }}
                className="box-border h-8 w-full rounded-ms-md border bg-ms-bg-component px-3 text-ms-base text-ms-text outline-none transition-colors duration-150 placeholder:text-ms-text-placeholder focus:border-ms-border-brand"
                style={{ borderColor: urlError ? "var(--signal-critical)" : "var(--ms-border-subtle)" }}
              />
            </div>
            <button
              onClick={submitUrl}
              disabled={!urlInput.trim() || urlLoading}
              className={
                "flex h-8 shrink-0 items-center gap-1.5 rounded-ms-md border-none px-3.5 text-ms-base font-medium transition-colors duration-150 " +
                (urlInput.trim() && !urlLoading
                  ? "ms-botao-marca cursor-pointer"
                  : "cursor-default bg-ms-bg-component text-ms-text-disabled")
              }
            >
              {urlLoading ? (
                <span className="ms-giro h-3 w-3 border-[1.5px]" />
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              )}
              Anexar
            </button>
          </div>
          {urlError && (
            <p className="mb-0 mt-1.5 text-ms-sm text-ms-text-danger">{urlError}</p>
          )}
        </div>

        {/* Scrollable grid */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden px-[18px] pb-[18px] pt-3.5">
          {fetching && displayItems.length === 0 ? (
            <div className="flex h-50 items-center justify-center">
              <span className="ms-giro h-6 w-6 border-2" />
            </div>
          ) : (
            <div className="grid grid-cols-8 gap-1">
              {onUpload && (
                <button
                  onClick={onUpload}
                  className="group flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-ms-md border-[1.5px] border-dashed border-ms-border bg-ms-bg-hover p-0 text-ms-text-tertiary transition-colors duration-150 hover:border-ms-border-strong hover:bg-ms-bg-component-hover hover:text-ms-text"
                >
                  <div className="flex h-[30px] w-[30px] items-center justify-center rounded-ms-full bg-ms-bg-component-active">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                  <span className="text-ms-xs font-medium">Enviar</span>
                </button>
              )}

              {displayItems.map((item) => {
                const isSelected = selectedUrls?.includes(item.url) ?? false;
                const atLimit = maxCount !== undefined && (selectedUrls?.length ?? 0) >= maxCount;
                const isDisabled = !isSelected && atLimit;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (isSelected) { onDeselect?.(item.url); return; }
                      if (!isDisabled) onPickUrl(item.url, item.mediaType);
                    }}
                    className="relative aspect-square overflow-hidden rounded-ms-md border-2 bg-ms-bg-component p-0"
                    style={{
                      borderColor: isSelected ? "var(--ms-solid-brand)" : "transparent",
                      cursor: isDisabled ? "not-allowed" : "pointer",
                      transition: "border-color 110ms, transform 110ms, opacity 110ms",
                      opacity: isDisabled ? 0.35 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (isDisabled) return;
                      setHoveredItemId(item.id);
                      if (!isSelected) e.currentTarget.style.borderColor = "var(--ms-border-strong)";
                      e.currentTarget.style.transform = "scale(1.04)";
                      const v = e.currentTarget.querySelector("video");
                      if (v) v.play().catch(() => {});
                      const overlay = e.currentTarget.querySelector<HTMLElement>(".picker-play-icon");
                      if (overlay) overlay.style.opacity = "0";
                    }}
                    onMouseLeave={(e) => {
                      setHoveredItemId(null);
                      if (!isSelected) e.currentTarget.style.borderColor = "transparent";
                      e.currentTarget.style.transform = "scale(1)";
                      const v = e.currentTarget.querySelector("video");
                      if (v) { v.pause(); v.currentTime = 0; }
                      const overlay = e.currentTarget.querySelector<HTMLElement>(".picker-play-icon");
                      if (overlay) overlay.style.opacity = "1";
                    }}
                  >
                    {item.mediaType === "video" ? (
                      <video
                        src={item.url}
                        muted
                        playsInline
                        preload="metadata"
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        onLoadedMetadata={(e) => { (e.target as HTMLVideoElement).currentTime = 0.001; }}
                      />
                    ) : (
                      <PickerImage src={item.url} />
                    )}
                    {item.mediaType === "video" && (
                      <div className="picker-play-icon" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", transition: "opacity 120ms" }}>
                        <div
                          className="flex h-[26px] w-[26px] items-center justify-center rounded-ms-full"
                          style={{ background: "var(--ms-blackA-7-hex)" }}
                        >
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="var(--ms-whiteA-12-hex)">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        </div>
                      </div>
                    )}
                    {hoveredItemId === item.id && (
                      <div
                        onClick={(e) => { e.stopPropagation(); setPreviewItem(item); }}
                        className="absolute right-1 top-1 z-[2] flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-ms-sm"
                        style={{ background: "var(--ms-blackA-8-hex)" }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ms-whiteA-11-hex)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}

              {displayItems.length === 0 && !fetching && (
                <div className="col-span-full py-12 text-center text-ms-md text-ms-text-tertiary">
                  Nada por aqui ainda
                </div>
              )}
            </div>
          )}
          {loadingMore && (
            <div className="flex justify-center p-4">
              <span className="ms-giro h-[18px] w-[18px] border-2" />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      {modal}
      {previewItem && createPortal(
        <div
          onClick={(e) => { e.stopPropagation(); setPreviewItem(null); }}
          className="fixed inset-0 z-[200000] flex items-center justify-center"
          style={{ background: "var(--ms-blackA-11-hex)" }}
        >
          {previewItem.mediaType === "video" ? (
            <video
              src={previewItem.url}
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-[90vw] rounded-ms-lg"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewItem.url}
              alt=""
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-[90vw] rounded-ms-lg object-contain"
            />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setPreviewItem(null); }}
            aria-label="Fechar"
            className="flex cursor-pointer items-center justify-center rounded-ms-full border" style={{ background: "var(--ms-whiteA-2-hex)", borderColor: "var(--ms-whiteA-3-hex)", color: "var(--ms-whiteA-10-hex)", position: "absolute", top: "20px", right: "20px", width: "32px", height: "32px" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
          {(() => {
            const idx = displayItems.findIndex(i => i.id === previewItem.id);
            return (
              <>
                {idx > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setPreviewItem(displayItems[idx - 1]); }}
                    aria-label="Anterior"
                    className="flex cursor-pointer items-center justify-center rounded-ms-full border" style={{ background: "var(--ms-whiteA-2-hex)", borderColor: "var(--ms-whiteA-3-hex)", color: "var(--ms-whiteA-10-hex)", position: "absolute", left: "20px", top: "50%", transform: "translateY(-50%)", width: "40px", height: "40px" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                )}
                {idx < displayItems.length - 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setPreviewItem(displayItems[idx + 1]); }}
                    aria-label="Próxima"
                    className="flex cursor-pointer items-center justify-center rounded-ms-full border" style={{ background: "var(--ms-whiteA-2-hex)", borderColor: "var(--ms-whiteA-3-hex)", color: "var(--ms-whiteA-10-hex)", position: "absolute", right: "20px", top: "50%", transform: "translateY(-50%)", width: "40px", height: "40px" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                )}
              </>
            );
          })()}
        </div>,
        document.body,
      )}
    </>
  );
}
