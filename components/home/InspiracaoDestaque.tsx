"use client";

/* ============================================================
   BLOCO 04, PARTE 2 — INSPIRAÇÃO EM DESTAQUE

   Cabeçalho com lâmpada, botão preto "Ver mais" e a grade de 4 colunas com
   oito cards de 307×247. A seção sangra 136,5px para cada lado do conteúdo
   de 1000px e vai a 1273 — duas larguras diferentes empilhadas. A
   desconformidade é intencional e está no original.

   Do card, o que veio do `inspiration-v2-card` da referência:

   - o LQIP embutido na própria URL, sem segundo endpoint. Lá é
     `?imageMogr2/thumbnail/32x/blur/16x8`; aqui é o `thumbSrc(url, 16)`, que
     cai no bucket de 32px do `/_next/image`. Mesma ideia, mesma chave, um
     request a mais de 32px de largura e nada além disso;
   - a capa nasce em `opacity: 0` e ganha `.is-loaded` no `onLoad`, com fade
     de .4s por cima do LQIP borrado (`blur(12px) scale(1.08)`);
   - `priority = index < 4`: os quatro primeiros carregam `eager`/`high`;
   - a `aspect-ratio` inline é limitada a [0.3, 1.78] e depois ANULADA na
     Home por um `!important`. É a regra de uma linha que faz o mesmo card
     servir à grade uniforme daqui e ao masonry de /inspiracao;
   - o hover é SÓ a sombra. O botão "Use prompt" existe no CSS e não é
     renderizado aqui — na referência também não.

   O que muda é o dado do rodapé: onde a referência mostra autor e views,
   mostramos modelo e data. Não medimos visualização e não há autoria a
   mostrar; inventar contador social seria número falso na tela.
   ============================================================ */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lightbulb } from "@/components/icones";

import { thumbSrc, type GalleryItem } from "@/lib/galleryUtils";

import "./destaque.css";

const TOTAL = 8;          /* G do bundle — pageSize 8 */
const RAZAO_MIN = 0.3;    /* q = e => Math.min(1.78, Math.max(0.3, e)) */
const RAZAO_MAX = 1.78;

/** `aspect_ratio` vem como "16:9"; o card quer o número, limitado. */
function razao(item: GalleryItem): number {
  const bruto = item.aspect_ratio ?? "";
  const [largura, altura] = bruto.split(":").map(Number);
  const valor = largura && altura ? largura / altura : 1;
  return Math.min(RAZAO_MAX, Math.max(RAZAO_MIN, valor));
}

const formatador = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/** "hoje" / "ontem" / "há 3 dias" / "12 set" — o `created_at`, legível. */
function dataRelativa(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((inicioDoDia(new Date()) - inicioDoDia(data)) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return formatador.format(data).replace(".", "");
}

/* O ícone de 12px do rodapé. A referência usa o `#icon-v5-view` — um símbolo
   de viewBox 16 com `stroke-width: 1.3`, desenhado a 12px. Como o dado aqui é
   data e não visualização, o desenho é outro; a caixa, o viewBox e a espessura
   são os mesmos, para o peso visual do rodapé não mudar. */
function IconeData() {
  return (
    <svg
      className="overflow-hidden inline-block"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 4.667V8l2 1.333"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function InspiracaoDestaque() {
  const router = useRouter();
  const [itens, setItens] = React.useState<GalleryItem[] | null>(null);

  React.useEffect(() => {
    let vivo = true;
    /* A referência pede uma página de 8 com `orderBy: "hot"`. Não medimos
       calor; o nosso "em destaque" é o mais recente, de imagem e vídeo. */
    Promise.all([
      fetch("/api/gallery?type=image&page=0").then(r => (r.ok ? r.json() : { items: [] })),
      fetch("/api/gallery?type=video&page=0").then(r => (r.ok ? r.json() : { items: [] })),
    ])
      .then(([imagens, videos]: { items?: GalleryItem[] }[]) => {
        if (!vivo) return;
        const todos = [...(imagens.items ?? []), ...(videos.items ?? [])];
        todos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setItens(todos.slice(0, TOTAL));
      })
      .catch(() => { if (vivo) setItens([]) });
    return () => { vivo = false };
  }, []);

  return (
    <section className="pi-section" aria-labelledby="pi-heading">
      <header className="pi-header">
        <h2 className="pi-heading" id="pi-heading">
          {/* Era `size 20 + strokeWidth 1.3 + absoluteStrokeWidth ⇒ stroke-width 1.56`.
              `absoluteStrokeWidth` é prop só do lucide: a camada de pixel não a tipa e
              ela vazaria como atributo inválido no DOM. Saiu; o `strokeWidth` fica
              porque a camada o engole de propósito. */}
          <Lightbulb size={20} strokeWidth={1.3} aria-hidden="true" />
          Inspiração em destaque
        </h2>
        <button type="button" className="pi-more" onClick={() => router.push("/inspiracao")}>
          Ver mais
        </button>
      </header>

      {itens === null ? (
        <div className="pi-grid">
          {Array.from({ length: TOTAL }).map((_, indice) => (
            <div key={indice} className="pi-skeleton" aria-hidden="true" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <p className="pi-empty">Ainda não há nada por aqui</p>
      ) : (
        <div className="pi-grid">
          {itens.map((item, indice) => (
            <CardDestaque
              key={`${item.source}-${item.id}`}
              item={item}
              prioritario={indice < 4}
              onAbrir={() => router.push(`/inspiracao?item=${encodeURIComponent(item.id)}`)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CardDestaque({
  item,
  prioritario,
  onAbrir,
}: {
  item: GalleryItem;
  /** Os quatro primeiros carregam sem esperar: `eager` + `fetchpriority high`. */
  prioritario: boolean;
  onAbrir: () => void;
}) {
  const [carregada, setCarregada] = React.useState(false);
  const ehVideo = item.mediaType === "video";

  const titulo = item.prompt?.trim() || (item.source === "upload" ? "Envio" : "Sem prompt");
  const modelo = item.model?.trim() || "envio";

  return (
    <article
      className="pi-card"
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={evento => {
        if (evento.key === "Enter" || evento.key === " ") {
          evento.preventDefault();
          onAbrir();
        }
      }}
    >
      <div className="pi-card__media">
        {ehVideo ? (
          /* O equivalente do `_preview.webp` animado da referência: ele fica
             sempre visível, sem fade, por cima da capa. Aqui não há capa
             separada — o próprio vídeo, mudo e em laço, é a prévia. */
          <video
            className="pi-card__overlay"
            src={item.url}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            aria-hidden="true"
          />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              aria-hidden="true"
              className="pi-card__image pi-card__image--cover pi-card__image--blur"
              draggable={false}
              decoding="async"
              src={thumbSrc(item.url, 16)}
            />
            <div className="pi-card__image-frame" style={{ aspectRatio: `${razao(item)} / 1` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className={`pi-card__image pi-card__image--cover pi-card__image--fade${carregada ? " is-loaded" : ""}`}
                draggable={false}
                loading={prioritario ? "eager" : "lazy"}
                fetchPriority={prioritario ? "high" : "auto"}
                decoding="async"
                src={thumbSrc(item.url, 307)}
                onLoad={() => setCarregada(true)}
              />
            </div>
          </>
        )}
      </div>

      <div className="pi-card__info">
        <div className="pi-card__info-top">
          <h3 className="pi-card__title" title={titulo}>{titulo}</h3>
        </div>
        <div className="pi-card__footer">
          <div className="pi-card__author">
            <span className="pi-mark" aria-hidden="true">{modelo.slice(0, 1)}</span>
            <span>{modelo}</span>
          </div>
          <div className="pi-card__stats">
            <span className="pi-card__stat">
              <IconeData />
              {dataRelativa(item.created_at)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
