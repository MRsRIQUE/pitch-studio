"use client";

/* ============================================================
   CARD DA INSPIRAÇÃO

   Réplica do `inspiration-v2-card`: capa com o quadro de proporção fixa, o
   mascote enquanto a capa não chega, e o rodapé em duas colunas onde o botão
   nasce no hover e empurra o que está à esquerda dele.

   O conteúdo é o nosso. O título é o prompt que gerou a peça; onde a referência
   põe avatar e nome do autor vai o modelo, e onde ela põe o contador de views
   vai a data — os campos que o `GalleryItem` tem de verdade. Não há autor a
   mostrar (as gerações são do próprio usuário) nem visualização a contar.

   A altura do card NÃO vem da estimativa do masonry: vem do `aspect-ratio` do
   quadro. A estimativa só posiciona a célula — é essa separação que faz o vão
   de 22px da referência e impede a grade de pular quando as capas carregam.
   ============================================================ */

import * as React from "react";
import { SaySellMark } from "@/components/SaySellLogo";
import { thumbSrc, type GalleryItem } from "@/lib/galleryUtils";
import { clampRatio } from "@/components/inspiracao/masonry";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/** "hoje" / "ontem" / "12 set" — a mesma informação do `created_at`, legível. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return dateFormatter.format(date).replace(".", "");
}

export function InspiracaoCard({
  item,
  ratio,
  priority,
  onRemix,
  onOpen,
  onMeasure,
}: {
  item: GalleryItem;
  /** A mesma proporção que a grade usou para posicionar a célula. */
  ratio: number;
  /** Os oito primeiros carregam sem esperar o observador (`loading="eager"`). */
  priority: boolean;
  onRemix: (item: GalleryItem) => void;
  onOpen: (item: GalleryItem) => void;
  /** Só é chamado quando a peça não tem `aspect_ratio` gravado: a grade estimou
      a altura com um palpite e agora pode corrigi-la com a medida real. */
  onMeasure: (id: string, ratio: number) => void;
}) {
  const cardRef = React.useRef<HTMLElement>(null);
  const [visivel, setVisivel] = React.useState(priority);
  const [carregada, setCarregada] = React.useState(false);
  const isVideo = item.mediaType === "video";

  /* `Ie = "300px 0px"` e `observer.disconnect()` na primeira interseção: o
     observador dispara uma vez só, como na referência. */
  React.useEffect(() => {
    if (visivel) return;
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisivel(true);
        observer.disconnect();
      }
    }, { rootMargin: "300px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [visivel]);

  const prompt = item.prompt?.trim();
  const data = formatDate(item.created_at);
  const temRatioGravado = Boolean(item.aspect_ratio && item.aspect_ratio !== "auto");
  const aspecto = clampRatio(ratio);

  const abrir = () => onOpen(item);

  return (
    <article
      ref={cardRef}
      className="insp-card"
      role="button"
      tabIndex={0}
      onClick={abrir}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          abrir();
        }
      }}
      aria-label={prompt ? `Abrir: ${prompt.slice(0, 80)}` : "Abrir geração"}
    >
      <div className="insp-card__media">
        {/* O mascote fica no fundo enquanto a capa não chega; a capa entra por
            cima com o fade de 400ms. */}
        <div className="insp-card__placeholder" aria-hidden>
          <SaySellMark size={40} />
        </div>

        {/* Blur-up: a miniatura de 32px que o nosso pipeline de imagem entrega,
            borrada pelo CSS. Mesmo truque do `imageMogr2/thumbnail/32x` deles —
            estado de carregamento sem asset extra. */}
        {visivel && !isVideo && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className="insp-card__image insp-card__image--cover insp-card__image--blur"
            src={thumbSrc(item.url, 16)}
            alt=""
            aria-hidden
            draggable={false}
            decoding="async"
          />
        )}

        <div className="insp-card__image-frame" style={{ aspectRatio: `${aspecto} / 1` }}>
          {visivel && (isVideo ? (
            /* O item de vídeo da referência carrega o webp animado sempre por
               cima da capa, sem hover. Aqui o próprio vídeo faz esse papel. */
            <video
              className={`insp-card__image insp-card__image--cover insp-card__image--fade${carregada ? " is-loaded" : ""}`}
              src={item.url}
              muted
              loop
              playsInline
              autoPlay
              preload="metadata"
              onLoadedMetadata={event => {
                const el = event.currentTarget;
                if (!temRatioGravado && el.videoWidth && el.videoHeight) {
                  onMeasure(item.id, el.videoWidth / el.videoHeight);
                }
              }}
              onLoadedData={() => setCarregada(true)}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              className={`insp-card__image insp-card__image--cover insp-card__image--fade${carregada ? " is-loaded" : ""}`}
              src={thumbSrc(item.url, 320)}
              alt={prompt ?? ""}
              draggable={false}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              decoding="async"
              onLoad={event => {
                const el = event.currentTarget;
                if (!temRatioGravado && el.naturalWidth && el.naturalHeight) {
                  onMeasure(item.id, el.naturalWidth / el.naturalHeight);
                }
                setCarregada(true);
              }}
            />
          ))}
        </div>
      </div>

      <div className="insp-card__info">
        <div className="insp-card__info-top">
          <h3 className="insp-card__title">{prompt || "Sem prompt"}</h3>
        </div>

        <div className="insp-card__footer">
          <div className="insp-card__model">{item.model ?? ""}</div>
          <div className="insp-card__stats">
            {data && <span className="insp-card__date">{data}</span>}
            {/* Sem prompt não há receita para devolver ao composer — e aí o
                botão não existe, em vez de existir sem fazer nada. */}
            {prompt && (
              <button
                type="button"
                className="insp-card__use-prompt"
                onClick={event => { event.stopPropagation(); onRemix(item); }}
              >
                Remixar
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
