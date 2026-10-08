"use client";

/**
 * 02 — Carrossel de banners em perspectiva
 *
 * Réplica do `home-v2-banner` do Miora (bloco 02). As constantes abaixo são as
 * mesmas do bundle da referência, com a letra original anotada ao lado; a
 * geometria está em `banner.css`.
 *
 * Os três banners são os do `.migracao/MAPA-AFORDANCIAS.md`, e cada um navega
 * de verdade: template de workflow, Criar com o modelo escolhido, Inspiração.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { makeUGCTemplate } from "@/lib/templates";
import { useWorkflowStore } from "@/lib/store";
import { useFolderStore } from "@/lib/folderStore";
import { VIDEO_MODELS } from "@/lib/modelConfig";
import "./banner.css";

/* ------------------------------------------------------------------ */
/* Constantes — os mesmos valores do bundle da referência              */
/* ------------------------------------------------------------------ */

const CARD_HEIGHT = 280;                        /* Zr */
const SIDE_HEIGHT = 225;                        /* Qr */
const RADIUS = 20;                              /* Je */
const SIDE_SCALE = SIDE_HEIGHT / CARD_HEIGHT;   /* Qe = 0,8035714285714286 */
const PERSPECTIVE = 3500;                       /* tn */
const ROTATE_Y = 72.8695;                       /* rn — graus por slot */
const SHIFT_X = 478.25;                         /* nn — deslocamento por slot */
const ROTATE_Z = -5;                            /* on */
const SQUASH = 0.5;                             /* sn */
const RADIUS_X = RADIUS / SQUASH;               /* an = 40 */
const RADIUS_Y = RADIUS / SIDE_SCALE;           /* ln = 24,888… */
const CQ_REF = 1249.85;                         /* cn — largura de referência */
const AUTOPLAY_MS = 1e4;                        /* un — 10 segundos */

/** `ce(e)`: px de projeto → cqw do `.pb-viewport`. */
const cq = (value: number) => `${((value / CQ_REF) * 100).toFixed(4)}cqw`;
/** `fe(e, r)`: módulo que nunca devolve negativo. */
const mod = (a: number, b: number) => ((a % b) + b) % b;

/* ------------------------------------------------------------------ */
/* Destinos                                                            */
/* ------------------------------------------------------------------ */

/** Mesmo nome que o painel de workflows usa, para o template não duplicar. */
const TEMPLATE_NAME = "UGC Template";

/**
 * O modelo do banner do meio. O id é conferido contra `VIDEO_MODELS` antes de
 * ser gravado — se ele sumir do catálogo, o banner ainda leva ao Criar, só sem
 * pré-seleção, em vez de gravar um id morto no `localStorage` do composer.
 * A arte carrega o nome escrito; os dois mudam juntos.
 */
const DESTAQUE_MODEL_ID = "seedance-2-5";

/** Espelha `settingsKey` de `app/gallery/page.tsx` e de `lib/remixHandoff.ts`.
 *  Duplicado de propósito: aquele arquivo não é nosso e a função não é
 *  exportada. Se o formato mudar lá, muda aqui. */
function settingsKey(tab: "images" | "videos", folderId: string | null): string {
  return folderId ? `nf-gallery-${tab}-folder-${folderId}` : `nf-gallery-${tab}`;
}

/**
 * Deixa o composer de vídeo já com o modelo em destaque escolhido e devolve a
 * rota do Criar. Mesma porta do Remix: o composer hidrata o estado inicial do
 * `localStorage`, então escrever na chave que ele lê e navegar basta.
 */
function abrirCriarComModelo(modelId: string): string {
  const tab = "videos" as const;
  const folderId = useFolderStore.getState().selectedFolderId;
  const rota = `/gallery?tab=${tab}&view=create${folderId ? `&folder=${folderId}` : ""}`;

  if (typeof window === "undefined") return rota;
  if (!VIDEO_MODELS.some(m => m.id === modelId)) return rota;

  const key = settingsKey(tab, folderId);
  let saved: Record<string, unknown> = {};
  try {
    saved = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, unknown>;
  } catch { /* chave corrompida: começa do zero */ }

  /* Troca só o modelo — o prompt e o resto da bancada do usuário ficam. */
  try {
    localStorage.setItem(key, JSON.stringify({ ...saved, modelId }));
  } catch { /* sem escrita, navega mesmo assim: o Criar abre no modelo salvo */ }

  return rota;
}

/* ------------------------------------------------------------------ */
/* Dados                                                               */
/* ------------------------------------------------------------------ */

export type BannerCard = {
  id: string;
  title: string;
  imageUrl?: string | null;
  /** Só é usado quando o card está no slot 0 — ver o ramo do <video>. */
  videoUrl?: string | null;
  /** O que o clique no card do meio faz. */
  acao: "workflow-ugc" | "modelo-destaque" | "inspiracao";
};

const destaque = VIDEO_MODELS.find(m => m.id === DESTAQUE_MODEL_ID);

export const bannersHome: BannerCard[] = [
  {
    id: "banner-workflow-ugc",
    title: "Workflow UGC — abrir o template pronto",
    imageUrl: "/pitch/banners/workflow-ugc.svg",
    videoUrl: null,
    acao: "workflow-ugc",
  },
  {
    id: "banner-modelo-destaque",
    /* O nome sai do catálogo, nunca de memória. */
    title: destaque
      ? `Modelo em destaque: ${destaque.name} — abrir no Criar`
      : "Modelo em destaque — abrir no Criar",
    imageUrl: "/pitch/banners/modelo-destaque.svg",
    videoUrl: null,
    acao: "modelo-destaque",
  },
  {
    id: "banner-inspiracao",
    title: "Inspiração em destaque — ver o que já foi criado",
    imageUrl: "/pitch/banners/inspiracao.svg",
    videoUrl: null,
    acao: "inspiracao",
  },
];

/* ------------------------------------------------------------------ */
/* Transform — o coração do bloco                                      */
/* ------------------------------------------------------------------ */

/**
 * O que encolhe os laterais é a PROJEÇÃO, não o `scale`: os três cards têm a
 * mesma caixa de 750×280. `translateX` de 478,25 (mais que meio card) somado a
 * um `rotateY` de quase 73° sob a `perspective` de 3500px do palco é que dobra
 * as pontas para dentro. A origem é o centro, o padrão — a referência não
 * escreve `transform-origin` em lugar nenhum.
 */
function transformFor(slot: number) {
  if (slot === 0) return "translateX(-50%)";
  return (
    `translateX(calc(-50% + ${slot} * ${cq(SHIFT_X)})) ` +
    `rotateZ(${-slot * ROTATE_Z}deg) ` +
    `rotateY(${-slot * ROTATE_Y}deg) ` +
    `scale(${SIDE_SCALE})`
  );
}

/**
 * Raio ELÍPTICO nos laterais: 40px / 24,889px. 40 = 20/0,5 compensa o
 * esmagamento horizontal da projeção; 24,889 = 20/scale compensa o `scale`.
 * Depois de projetado, o canto volta a parecer os 20px circulares do meio.
 */
function radiusFor(slot: number) {
  return slot === 0 ? undefined : `${cq(RADIUS_X)} / ${cq(RADIUS_Y)}`;
}

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

export default function BannerCarrossel({
  banners = bannersHome,
}: {
  banners?: BannerCard[];
}) {
  const router = useRouter();
  const createSpace = useWorkflowStore(s => s.createSpace);
  const deleteSpace = useWorkflowStore(s => s.deleteSpace);

  /** `p` — inteiro que só cresce; a posição no anel é `mod(p, n)`. */
  const [index, setIndex] = useState(0);
  /** `a` — hover sobre a <section> inteira. */
  const [hovered, setHovered] = useState(false);

  const count = banners.length;
  const ready = count > 0;
  const active = ready ? mod(index, count) : 0;   /* `v` */

  const next = useCallback(() => setIndex(p => p + 1), []);   /* `b` */

  /**
   * `C`: o ponto leva pelo CAMINHO MAIS CURTO do anel, não para o índice
   * absoluto. Com 3 banners, ir do 1º para o 3º anda −1, e não +2 — o
   * carrossel nunca desenrola meia volta para chegar num vizinho.
   */
  const goTo = useCallback((target: number) => {
    setIndex(p => {
      if (count === 0) return p;
      let delta = target - mod(p, count);
      if (delta > count / 2) delta -= count;
      if (delta < -count / 2) delta += count;
      return p + delta;
    });
  }, [count]);

  /**
   * O efeito depende de `hovered`, então cada entrada e saída do mouse derruba
   * e recria o intervalo: o hover pausa, e sair do hover recomeça a contagem do
   * zero — não retoma de onde parou. É o comportamento da referência.
   */
  useEffect(() => {
    if (!ready || hovered || count < 2) return;
    const id = window.setInterval(next, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [ready, hovered, count, next]);

  /**
   * Cria o template UGC do zero e abre. Mesma sequência do painel de workflows:
   * um template velho com o mesmo nome é descartado antes, senão o usuário
   * acumularia cópias a cada clique no banner.
   */
  const abrirTemplateUGC = useCallback(() => {
    const store = useWorkflowStore.getState();
    const existente = store.spaces.find(sp => sp.name === TEMPLATE_NAME);
    if (existente) {
      /* Apagar o único space deixaria o store sem nenhum. */
      if (store.spaces.length === 1) store.createSpace("Space 1");
      deleteSpace(existente.id);
    }
    createSpace(TEMPLATE_NAME, makeUGCTemplate());
    router.push(`/workflow/${useWorkflowStore.getState().activeSpaceId}`);
  }, [createSpace, deleteSpace, router]);

  /** `S(card, slot)`: no lateral, anda na direção dele; no meio, abre. */
  const handleClick = useCallback((card: BannerCard, slot: number) => {
    if (slot !== 0) {
      setIndex(p => p + slot);
      return;
    }
    if (card.acao === "workflow-ugc") { abrirTemplateUGC(); return; }
    if (card.acao === "modelo-destaque") { router.push(abrirCriarComModelo(DESTAQUE_MODEL_ID)); return; }
    router.push("/inspiracao");
  }, [abrirTemplateUGC, router]);

  /**
   * `A` — sempre exatamente 3 cards no DOM, e a `key` é o índice ABSOLUTO
   * (`virtual`), não o slot. É daí que saem as três animações diferentes de
   * graça: a key que continua existindo reaproveita o nó e roda a
   * `transition: transform .5s`; a key que some desmonta sem saída; a key nova
   * monta e roda `pb-card-in .45s`. Com a key no slot, os três piscariam.
   */
  const visible = useMemo(() => {
    if (count === 0) return [] as { slot: number; virtual: number; card: BannerCard }[];
    const out: { slot: number; virtual: number; card: BannerCard }[] = [];
    for (let slot = -1; slot <= 1; slot += 1) {
      const virtual = index + slot;
      out.push({ slot, virtual, card: banners[mod(virtual, count)] });
    }
    return out;
  }, [index, count, banners]);

  return (
    <div className="pb-page">
      <div className="pb-content">
        <section
          className={`pb-banner${ready ? "" : " pb-banner--empty"}`}
          aria-label="Destaques"
          aria-busy={!ready}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div className="pb-viewport">
            {/* a perspective é do PALCO, em cqw, e não de cada card */}
            <div className="pb-stage" style={{ perspective: cq(PERSPECTIVE) }}>
              {!ready && <div className="pb-placeholder" aria-hidden="true" />}

              {visible.map(({ slot, virtual, card }) => {
                const isMain = slot === 0;
                return (
                  <div
                    key={virtual}
                    className={`pb-card${isMain ? " pb-card--main" : ""}`}
                    data-slot={slot}
                    style={{ transform: transformFor(slot), borderRadius: radiusFor(slot) }}
                    role="button"
                    tabIndex={isMain ? 0 : -1}
                    aria-label={card.title}
                    aria-hidden={!isMain}
                    onClick={() => handleClick(card, slot)}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleClick(card, slot);
                      }
                    }}
                  >
                    {/* Só o card do meio pode ser vídeo: três vídeos girados em
                        3D seriam caros à toa. Os laterais entram como imagem. */}
                    {card.videoUrl && isMain ? (
                      <video
                        className="pb-media"
                        src={card.videoUrl}
                        poster={card.imageUrl || undefined}
                        muted
                        loop
                        playsInline
                        autoPlay
                      />
                    ) : (
                      card.imageUrl && (
                        /* Arte local, estática, de tamanho conhecido: o <img>
                           cru evita o otimizador e a mudança de layout. */
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          className="pb-media"
                          src={card.imageUrl}
                          alt=""
                          draggable={false}
                          loading="eager"
                        />
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pb-dots-slot">
            {count > 1 && (
              <div className="pb-dots" role="tablist" aria-label="Escolher destaque">
                {banners.map((card, i) => (
                  <button
                    key={card.id}
                    type="button"
                    role="tab"
                    aria-selected={i === active}
                    aria-label={card.title}
                    className={`pb-dot${i === active ? " pb-dot--active" : ""}`}
                    onClick={() => goTo(i)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
