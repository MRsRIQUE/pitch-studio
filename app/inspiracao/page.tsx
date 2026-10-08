"use client";

/* ============================================================
   INSPIRAÇÃO — bloco 05

   Réplica de `miora/sections/05-inspiration-box`: título e busca na mesma
   linha, faixa de chips, ordenação e navegação à direita, masonry de 4 colunas
   com cards de altura variável e o mini-composer preso ao rodapé.

   A estrutura da rolagem é a da referência, e ela importa: o
   `.app-v2-main-scroll` (padding 20/24) é quem rola, a `.insp-page` cresce
   dentro dele com `max-width:1310px`, e é por isso que o `position:sticky` do
   composer tem onde se prender. Numa viewport de 1920 com a nav de 250px, a
   página começa em x=430 e termina em x=1739.

   O conteúdo é nosso: as gerações da conta, lidas do mesmo `/api/gallery` que o
   Acervo lê, com `source=generation` — o que foi só enviado não tem prompt, e
   sem prompt não há o que remixar.
   ============================================================ */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getToken, type GalleryItem } from "@/lib/galleryUtils";
import { remixToComposer } from "@/lib/remixHandoff";
import { useFolderStore } from "@/lib/folderStore";
import { InspiracaoCard } from "@/components/inspiracao/InspiracaoCard";
import { InspiracaoComposer } from "@/components/inspiracao/InspiracaoComposer";
import {
  InspiracaoHeader,
  type InspiracaoCategoria,
  type InspiracaoSort,
} from "@/components/inspiracao/InspiracaoHeader";
import { InspiracaoPreview } from "@/components/inspiracao/InspiracaoPreview";
import { Receitas } from "@/components/inspiracao/Receitas";
import { estimateHeight, layoutMasonry, parseRatio } from "@/components/inspiracao/masonry";
import "@/components/inspiracao/inspiracao.css";

/* Proporção usada só enquanto a peça não tem `aspect_ratio` gravado nem capa
   carregada. Assim que a capa chega, o card informa a proporção real e a grade
   se refaz. */
const FALLBACK_RATIO = { image: 1, video: 16 / 9 };

/** `priority = index < 8` — os oito primeiros vêm com `loading="eager"`. */
const PRIORITY_COUNT = 8;

/** Largura de referência da página, usada antes de o observador medir. */
const REF_WIDTH = 1310;

/* Uma sugestão do mini-composer precisa caber na linha de 620px do campo. Além
   disso, o `Tab` a aceita inteira: um prompt cortado viraria um prompt errado. */
const SUGESTAO_MAX = 90;
const SUGESTOES_MAX = 8;

/** O chip sintético que mostra as receitas no lugar da grade. */
const RECEITAS_ID = "receitas";

export default function InspiracaoPage() {
  const router = useRouter();

  const [items, setItems] = React.useState<GalleryItem[]>([]);
  const [page, setPage] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const loadingRef = React.useRef(false);

  const [categoria, setCategoria] = React.useState("all");
  const [sort, setSort] = React.useState<InspiracaoSort>("recent");
  const [query, setQuery] = React.useState("");

  const [measured, setMeasured] = React.useState<Record<string, number>>({});
  const [preview, setPreview] = React.useState<GalleryItem | null>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  /* Os chips são as pastas do usuário: o único eixo de categoria que existe de
     verdade do nosso lado. `itemFolderMap` diz em quais pastas cada peça está. */
  const folders = useFolderStore(state => state.folders);
  const itemFolderMap = useFolderStore(state => state.itemFolderMap);
  const loadFolders = useFolderStore(state => state.loadFromServer);

  React.useEffect(() => { void loadFolders(); }, [loadFolders]);

  /* ── Carga ────────────────────────────────────────────────
     Imagem e vídeo são coleções separadas na API; a página busca a mesma página
     das duas e junta por data. Como cada fila já vem ordenada, o prefixo
     resultante fica correto. */
  const loadPage = React.useCallback(async (target: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const token = await getToken();
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };
      const [imageRes, videoRes] = await Promise.all([
        fetch(`/api/gallery?type=image&page=${target}&source=generation`, { headers }),
        fetch(`/api/gallery?type=video&page=${target}&source=generation`, { headers }),
      ]);
      const image = imageRes.ok ? (await imageRes.json() as { items: GalleryItem[]; hasMore: boolean }) : { items: [], hasMore: false };
      const video = videoRes.ok ? (await videoRes.json() as { items: GalleryItem[]; hasMore: boolean }) : { items: [], hasMore: false };

      setItems(previous => {
        const seen = new Set(previous.map(entry => entry.id));
        const fresh = [...image.items, ...video.items].filter(entry => entry.url && !seen.has(entry.id));
        if (fresh.length === 0) return previous;
        return [...previous, ...fresh].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      });
      setHasMore(image.hasMore || video.hasMore);
      setPage(target);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void loadPage(0); }, [loadPage]);

  /* Sentinela no fim da grade: pede a próxima página antes de o usuário chegar
     no fundo. */
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void loadPage(page + 1);
    }, { rootMargin: "600px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, page, loadPage]);

  /* ── Medidas ──────────────────────────────────────────────
     A largura da coluna vem do container, não da viewport: a nav colapsa.
     Ref de callback em vez de `useRef` + efeito, porque a grade sai e volta do
     DOM quando os filtros esvaziam a lista. */
  const observerRef = React.useRef<ResizeObserver | null>(null);
  const gridRef = React.useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    if (!el) return;
    setContainerWidth(Math.round(el.getBoundingClientRect().width));
    const observer = new ResizeObserver(entries => {
      setContainerWidth(Math.round(entries[0]?.contentRect.width ?? 0));
    });
    observer.observe(el);
    observerRef.current = observer;
  }, []);

  /* O "Tudo" não vem de lista nenhuma — é sintético, como o `All` da
     referência, e é o único chip que nasce ativo. "Receitas" também é
     sintético: não filtra a grade, troca a grade por `lib/receitas.ts` —
     material que existe antes da primeira geração do usuário. */
  const categorias = React.useMemo<InspiracaoCategoria[]>(
    () => [
      { id: "all", name: "Tudo" },
      { id: RECEITAS_ID, name: "Receitas" },
      ...[...folders]
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map(folder => ({ id: folder.id, name: folder.name })),
    ],
    [folders],
  );

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = items.filter(entry => {
      if (categoria !== "all" && !(itemFolderMap[entry.id] ?? []).includes(categoria)) return false;
      if (needle && !(entry.prompt ?? "").toLowerCase().includes(needle)) return false;
      return true;
    });
    if (sort === "oldest") {
      return [...filtered].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return filtered;
  }, [items, categoria, itemFolderMap, query, sort]);

  const ratios = React.useMemo(
    () => visible.map(entry => parseRatio(entry.aspect_ratio) ?? measured[entry.id] ?? FALLBACK_RATIO[entry.mediaType]),
    [visible, measured],
  );

  const grid = React.useMemo(
    () => layoutMasonry(containerWidth || REF_WIDTH, ratios),
    [containerWidth, ratios],
  );

  /* Enquanto a primeira página não chega não há proporção nenhuma para
     posicionar, então o esqueleto tem a sua própria grade — quatro alturas que
     se repetem, só para a página já nascer com o ritmo certo. */
  const showSkeleton = loading && items.length === 0;
  const skeletonRatios = React.useMemo(
    () => Array.from({ length: 12 }, (_, index) => [1, 0.75, 1.5, 1.2][index % 4]),
    [],
  );
  const skeleton = React.useMemo(
    () => layoutMasonry(containerWidth || REF_WIDTH, skeletonRatios),
    [containerWidth, skeletonRatios],
  );

  /* As sugestões do mini-composer são os prompts que a página já carregou. */
  const sugestoes = React.useMemo(() => {
    const vistos = new Set<string>();
    const saida: string[] = [];
    for (const entry of items) {
      const prompt = entry.prompt?.trim();
      if (!prompt || prompt.length > SUGESTAO_MAX || vistos.has(prompt)) continue;
      vistos.add(prompt);
      saida.push(prompt);
      if (saida.length >= SUGESTOES_MAX) break;
    }
    return saida;
  }, [items]);

  const handleRemix = React.useCallback((item: GalleryItem) => {
    const href = remixToComposer({
      prompt: item.prompt,
      model: item.model,
      aspectRatio: item.aspect_ratio,
      quality: item.quality,
      azureResolution: item.azure_resolution,
      referenceImageUrls: item.referenceImageUrls,
      mediaType: item.mediaType,
    });
    if (href) router.push(href);
  }, [router]);

  const handleComposer = React.useCallback((prompt: string) => {
    const href = remixToComposer({ prompt, mediaType: "image" });
    if (href) router.push(href);
  }, [router]);

  const mostrandoReceitas = categoria === RECEITAS_ID;
  const isEmpty = !mostrandoReceitas && !loading && items.length === 0;
  const isFilteredEmpty = !mostrandoReceitas && !loading && items.length > 0 && visible.length === 0;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-6 py-5">
      <div className="insp-page">
        <InspiracaoHeader
          categorias={categorias}
          categoria={categoria}
          onCategoriaChange={setCategoria}
          sort={sort}
          onSortChange={setSort}
          query={query}
          onQueryChange={setQuery}
        />

        {mostrandoReceitas ? (
          <Receitas query={query} />
        ) : isEmpty ? (
          <div className="insp-empty">
            <h2>Ainda não há o que remixar</h2>
            <p>A Inspiração mostra as suas próprias gerações — e você ainda não fez nenhuma.</p>
            <Link href="/gallery?tab=images&view=create">Começar a criar</Link>
          </div>
        ) : isFilteredEmpty ? (
          <div className="insp-empty">
            <h2>Nenhuma geração com esses filtros</h2>
            <p>Tente outra pasta ou limpe a busca.</p>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div
              ref={gridRef}
              className="insp-grid"
              style={{ height: (showSkeleton ? skeleton : grid).totalHeight }}
            >
              {showSkeleton
                ? skeleton.cells.map((cell, index) => (
                    <div
                      key={`skeleton-${index}`}
                      className="insp-cell"
                      style={{
                        top: cell.top,
                        left: cell.left,
                        width: cell.width,
                        height: estimateHeight(skeletonRatios[index], cell.width),
                      }}
                    >
                      <div className="insp-skeleton" />
                    </div>
                  ))
                : visible.map((item, index) => {
                    const cell = grid.cells[index];
                    if (!cell) return null;
                    return (
                      <div
                        key={item.id}
                        className="insp-cell"
                        style={{ top: cell.top, left: cell.left, width: cell.width }}
                      >
                        <InspiracaoCard
                          item={item}
                          ratio={ratios[index]}
                          priority={index < PRIORITY_COUNT}
                          onRemix={handleRemix}
                          onOpen={setPreview}
                          onMeasure={(id, ratio) =>
                            setMeasured(previous => (previous[id] === ratio ? previous : { ...previous, [id]: ratio }))
                          }
                        />
                      </div>
                    );
                  })}
            </div>

            <div ref={sentinelRef} aria-hidden style={{ height: 1 }} />
          </div>
        )}

        <InspiracaoComposer sugestoes={sugestoes} onEnviar={handleComposer} />
      </div>

      <div className="insp-footer">
        <span>Pitch Studio · as suas gerações, prontas para remixar</span>
      </div>

      {preview && (
        <InspiracaoPreview
          item={preview}
          onClose={() => setPreview(null)}
          onRemix={item => { setPreview(null); handleRemix(item); }}
        />
      )}
    </div>
  );
}
