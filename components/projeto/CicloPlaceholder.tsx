"use client";

/* ============================================================
   O PLACEHOLDER — a peça mais copiada e mais mal copiada do bloco 09

   Um clone preguiçoso põe um spinner centralizado numa caixa genérica. O do
   Miora é outra coisa:

   1. nasce do TAMANHO EXATO do artefato que vai chegar, porque a geometria já é
      conhecida antes de a mídia existir — por isso o layout não pula quando a
      imagem entra;
   2. aparece nos DOIS lugares ao mesmo tempo, miniatura do chat e canvas, com o
      mesmo shimmer, no mesmo instante;
   3. é rotulado: a pílula branca de 85×28 com "Gerando", centrada nos dois.

   Por isso este componente é um só, com a caixa vinda de fora: quem desenha a
   miniatura e quem desenha o nó do canvas chamam o mesmo desenho. Duas cópias
   do shimmer sairiam de fase na primeira semana.

   E não há transição de placeholder para imagem: a troca é instantânea, o que
   muda é só o conteúdo dentro da mesma caixa. É a razão de a `<img>` e o
   placeholder viverem no mesmo `.ciclo-caixa-artefato`.
   ============================================================ */

import * as React from "react";
import { T } from "./CicloTextos";
import "./ciclo.css";

export interface PropsPlaceholder {
  /** Largura da caixa na tela. Aceita px ou qualquer medida CSS. */
  largura?: number | string;
  altura?: number | string;
  /** Some com a pílula quando a caixa é pequena demais para os 85×28. */
  comPilula?: boolean;
  className?: string;
}

export function CicloPlaceholder({
  largura = "100%",
  altura = "100%",
  comPilula = true,
  className,
}: PropsPlaceholder) {
  return (
    <div
      className={`ciclo-caixa-artefato${className ? ` ${className}` : ""}`}
      style={{ width: largura, height: altura }}
    >
      {/* `--fresh` é o modificador literal do bundle: é ele que liga o shimmer. */}
      <div
        className="wf-media-load-placeholder wf-media-load-placeholder--fresh"
        style={{ width: "100%", height: "100%" }}
        role="img"
        aria-label={T.midia.generating}
      />
      {comPilula && <div className="ciclo-pilula-gerando">{T.midia.generating}</div>}
    </div>
  );
}

/**
 * A caixa do artefato: o placeholder e o resultado ocupam exatamente o mesmo
 * espaço. Enquanto `url` é indefinida mostra o shimmer; quando chega, troca o
 * conteúdo sem animação nenhuma — que é o comportamento medido.
 */
export function CicloArtefato({
  url,
  alt,
  largura,
  altura,
  comPilula = true,
  children,
}: {
  url?: string;
  alt: string;
  largura?: number | string;
  altura?: number | string;
  comPilula?: boolean;
  /** A régua de ações que aparece no hover, quando há resultado. */
  children?: React.ReactNode;
}) {
  if (!url) {
    return <CicloPlaceholder largura={largura} altura={altura} comPilula={comPilula} />;
  }

  return (
    <div className="ciclo-caixa-artefato" style={{ width: largura, height: altura }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a peça vem de CDN
          assinada com expiração; o otimizador do Next não a alcança. */}
      <img src={url} alt={alt} draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      {children}
    </div>
  );
}
