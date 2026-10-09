"use client";

/* ============================================================
   GALERIA LATERAL

   Porte do painel da direita do BoardUI
   (`www.boardui.com/templates/ai-image-generation`): duas abas com o indicador
   que desliza e muda de largura, três ações no canto, e a grade de três colunas
   de altura variável em que cada peça revela, no hover, uma sobreposição com os
   botões em cima e a legenda embaixo.

   A geometria e as animações estão medidas em `galeria-lateral.css`; a regra de
   repartição das colunas — que NÃO é o masonry de coluna mais baixa — está em
   `galeriaColunas.ts`. Aqui fica só o comportamento.

   Cada controle vai a uma capacidade que existe de verdade:

   - "Nova geração"   → o Criar (`/gallery?view=create`)
   - "Expandir"       → alterna a largura do painel entre a medida e o limite
   - "Recolher"       → fecha o painel; quem o reabre é o botão que o pai desenha
   - arrastar a divisa→ redimensiona o painel, com limite
   - "Ampliar"        → a prévia da peça
   - "Baixar"         → a própria URL da geração
   - "Mais ações"     → remixar (leva o prompt ao composer) e copiar o prompt
   - aba "Estilos"    → a tela de Estilos, que é onde eles moram de verdade

   O BoardUI entrega a aba `Styles` como um cartão vazio escrito "Style
   presets". Copiar o cartão vazio seria copiar um lugar sem destino, então ele
   ficou com a mesma caixa e um caminho que funciona.
   ============================================================ */

import * as React from "react";
import Link from "next/link";
import {
  Copy,
  Download,
  Flame,
  Images,
  Maximize2,
  MoreHorizontal,
  Palette,
  PanelRightClose,
  Plus,
  Shuffle,
} from "lucide-react";
import { thumbSrc, type GalleryItem } from "@/lib/galleryUtils";
import { distribuirEmColunas } from "@/components/inspiracao/galeriaColunas";
import { parseRatio } from "@/components/inspiracao/masonry";
import { PainelQuentes } from "@/components/produtos/PainelQuentes";
import "./galeria-lateral.css";

/** Largura do painel medida no BoardUI, e o limite do arrasto (escolha nossa). */
export const LARGURA_PADRAO = 410;
export const LARGURA_MIN = 320;
export const LARGURA_MAX = 820;

/** Três colunas, como no painel de origem. */
const COLUNAS = 3;

/** Quanto o menu de "mais ações" desce em relação ao botão que o abriu. */
const MENU_DESLOCAMENTO = 4;

type Aba = "galeria" | "estilos" | "quentes";
type Menu = { item: GalleryItem; direita: number; topo: number };

export function GaleriaLateral({
  itens,
  carregando = false,
  largura,
  onLargura,
  className,
  onAmpliar,
  onRemixar,
  onNovaGeracao,
  onRecolher,
  recolhido,
}: {
  itens: GalleryItem[];
  carregando?: boolean;
  /* A largura é controlada de fora porque, sobre o grafo, ela também move o
     cromo da direita: quem a guarda é quem publica o `--gal-largura` na raiz. */
  largura: number;
  onLargura: (largura: number) => void;
  /** Modificador de montagem — ver `galeria-projeto.css`. */
  className?: string;
  /** Sobre o grafo o painel não desmonta ao fechar: ele desliza para fora. */
  recolhido?: boolean;
  onAmpliar: (item: GalleryItem) => void;
  onRemixar: (item: GalleryItem) => void;
  onNovaGeracao: () => void;
  onRecolher: () => void;
}) {
  const [aba, setAba] = React.useState<Aba>("galeria");
  const [arrastando, setArrastando] = React.useState(false);
  const [menu, setMenu] = React.useState<Menu | null>(null);

  const abasRef = React.useRef<HTMLDivElement>(null);
  const indicadorRef = React.useRef<HTMLSpanElement>(null);

  /* O indicador é posicionado no DOM, não por estado: ele precisa da medida
     real do botão ativo, e escrever no `style` evita uma renderização a mais a
     cada troca de aba — além de deixar a transição do CSS no comando. */
  React.useEffect(() => {
    const caixa = abasRef.current;
    const indicador = indicadorRef.current;
    if (!caixa || !indicador) return;

    const reposicionar = () => {
      const ativo = caixa.querySelector<HTMLButtonElement>('[aria-selected="true"]');
      if (!ativo) return;
      indicador.style.width = `${ativo.offsetWidth}px`;
      indicador.style.height = `${ativo.offsetHeight}px`;
      indicador.style.transform = `translateX(${ativo.offsetLeft}px)`;
    };

    reposicionar();
    const observador = new ResizeObserver(reposicionar);
    observador.observe(caixa);
    return () => observador.disconnect();
  }, [aba]);

  /* Fecha o menu de "mais ações" no clique fora, no Escape e ao rolar — ele é
     `position:fixed` e ficaria parado enquanto a peça sobe. */
  React.useEffect(() => {
    if (!menu) return;
    const fechar = () => setMenu(null);
    const tecla = (evento: KeyboardEvent) => { if (evento.key === "Escape") setMenu(null); };
    document.addEventListener("mousedown", fechar);
    document.addEventListener("keydown", tecla);
    window.addEventListener("scroll", fechar, true);
    return () => {
      document.removeEventListener("mousedown", fechar);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", fechar, true);
    };
  }, [menu]);

  const colunas = React.useMemo(
    () => distribuirEmColunas(itens, COLUNAS, item => parseRatio(item.aspect_ratio) ?? 1),
    [itens],
  );

  /* O arrasto muda a largura pela distância percorrida, não pela posição do
     ponteiro: assim a divisa não "pula" para debaixo do cursor no primeiro
     movimento. */
  const iniciarArrasto = (evento: React.PointerEvent<HTMLDivElement>) => {
    evento.preventDefault();
    const alvo = evento.currentTarget;
    const xInicial = evento.clientX;
    const larguraInicial = largura;
    alvo.setPointerCapture(evento.pointerId);
    setArrastando(true);

    const mover = (e: PointerEvent) => {
      const proposta = larguraInicial + (xInicial - e.clientX);
      onLargura(Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, Math.round(proposta))));
    };
    const soltar = () => {
      setArrastando(false);
      alvo.releasePointerCapture(evento.pointerId);
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerup", soltar);
      alvo.removeEventListener("pointercancel", soltar);
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", soltar);
    alvo.addEventListener("pointercancel", soltar);
  };

  const alternarLargura = () => {
    onLargura(largura >= LARGURA_MAX ? LARGURA_PADRAO : LARGURA_MAX);
  };

  const abrirMenu = (item: GalleryItem, caixa: DOMRect) => {
    setMenu(atual =>
      atual?.item.id === item.id
        ? null
        : {
            item,
            direita: Math.round(window.innerWidth - caixa.right),
            topo: Math.round(caixa.bottom + MENU_DESLOCAMENTO),
          },
    );
  };

  const promptDoMenu = menu?.item.prompt?.trim();

  return (
    <aside
      className={`gal${className ? ` ${className}` : ""}`}
      style={{ width: largura, minWidth: largura, maxWidth: largura, flexBasis: largura }}
      aria-label="Galeria"
      data-recolhido={recolhido ? "true" : undefined}
      aria-hidden={recolhido || undefined}
    >
      <div
        className="gal__separador"
        data-arrastando={arrastando}
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar o painel"
        onPointerDown={iniciarArrasto}
        onDoubleClick={() => onLargura(LARGURA_PADRAO)}
      >
        <span className="gal__punho" aria-hidden>
          <span /><span /><span />
        </span>
      </div>

      {/* ── Cabeçalho ── */}
      <div className="gal__cabecalho">
        <div className="gal__abas" ref={abasRef} role="tablist" aria-label="Vista do painel">
          <span className="gal__indicador" ref={indicadorRef} aria-hidden />
          <button
            type="button"
            role="tab"
            aria-selected={aba === "galeria"}
            className="gal__aba"
            onClick={() => setAba("galeria")}
          >
            <span className="gal__aba-realce" aria-hidden />
            <Images size={18} strokeWidth={1.75} />
            Galeria
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === "estilos"}
            className="gal__aba"
            onClick={() => setAba("estilos")}
          >
            <span className="gal__aba-realce" aria-hidden />
            <Palette size={18} strokeWidth={1.75} />
            Estilos
          </button>
          {/* A terceira aba. O rótulo é "Quentes" e não "Produtos quentes"
              porque o cabeçalho tem 410px divididos com três ações à
              direita — e "Quentes" é o nome que a coisa já tem no PitchAI. */}
          <button
            type="button"
            role="tab"
            aria-selected={aba === "quentes"}
            className="gal__aba"
            onClick={() => setAba("quentes")}
          >
            <span className="gal__aba-realce" aria-hidden />
            <Flame size={18} strokeWidth={1.75} />
            Quentes
          </button>
        </div>

        <div className="gal__acoes">
          <button type="button" className="gal__acao" aria-label="Nova geração" onClick={onNovaGeracao}>
            <Plus size={18} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="gal__acao"
            aria-label={largura >= LARGURA_MAX ? "Reduzir o painel" : "Expandir o painel"}
            onClick={alternarLargura}
          >
            <Maximize2 size={18} strokeWidth={1.75} />
          </button>
          <button type="button" className="gal__acao" aria-label="Recolher o painel" onClick={onRecolher}>
            <PanelRightClose size={18} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* ── Corpo ── */}
      <div className="gal__rolagem">
        {aba === "quentes" ? (
          <PainelQuentes />
        ) : aba === "estilos" ? (
          <div className="gal__vazio">
            <p>Os seus estilos moram na tela de Estilos.</p>
            <Link href="/estilos">Abrir Estilos</Link>
          </div>
        ) : carregando && itens.length === 0 ? (
          <div className="gal__colunas">
            {Array.from({ length: COLUNAS }, (_, coluna) => (
              <div className="gal__coluna" key={coluna}>
                {[0.75, 1, 0.5625].map((proporcao, linha) => (
                  <div
                    key={linha}
                    className="gal__esqueleto"
                    style={{ aspectRatio: `${proporcao} / 1` }}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : itens.length === 0 ? (
          <div className="gal__vazio">
            <p>Nada gerado ainda.</p>
            <Link href="/gallery?tab=images&view=create">Começar a criar</Link>
          </div>
        ) : (
          <div className="gal__colunas">
            {colunas.map((coluna, indiceColuna) => (
              <div className="gal__coluna" key={indiceColuna}>
                {coluna.map(item => (
                  <CardGaleria
                    key={item.id}
                    item={item}
                    menuAberto={menu?.item.id === item.id}
                    onAbrirMenu={abrirMenu}
                    onAmpliar={onAmpliar}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {menu && promptDoMenu && (
        <div
          className="gal__menu"
          role="menu"
          style={{ right: menu.direita, top: menu.topo }}
          onMouseDown={evento => evento.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="gal__menu-item"
            onClick={() => { setMenu(null); onRemixar(menu.item); }}
          >
            <Shuffle size={14} strokeWidth={1.75} />
            Remixar
          </button>
          <button
            type="button"
            role="menuitem"
            className="gal__menu-item"
            onClick={async () => {
              setMenu(null);
              try { await navigator.clipboard.writeText(promptDoMenu); }
              catch { /* área de transferência negada: nada a fazer */ }
            }}
          >
            <Copy size={14} strokeWidth={1.75} />
            Copiar prompt
          </button>
        </div>
      )}
    </aside>
  );
}

function CardGaleria({
  item,
  menuAberto,
  onAbrirMenu,
  onAmpliar,
}: {
  item: GalleryItem;
  menuAberto: boolean;
  onAbrirMenu: (item: GalleryItem, caixa: DOMRect) => void;
  onAmpliar: (item: GalleryItem) => void;
}) {
  const prompt = item.prompt?.trim();
  const rotulo = prompt || "Geração sem prompt";
  const proporcao = parseRatio(item.aspect_ratio) ?? 1;
  const isVideo = item.mediaType === "video";

  return (
    <figure className="gal__card">
      <div className="gal__quadro" style={{ aspectRatio: `${proporcao} / 1` }}>
        {isVideo ? (
          <video className="gal__midia" src={item.url} muted loop playsInline autoPlay preload="metadata" />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className="gal__midia"
            src={thumbSrc(item.url, 128)}
            alt={rotulo}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        )}

        <button
          type="button"
          className="gal__ampliar"
          aria-label={`Ampliar ${rotulo}`}
          onClick={() => onAmpliar(item)}
        />

        <div className="gal__sobreposicao">
          <span className="gal__sobreposicao-acoes">
            <a
              className="gal__botao-flutuante"
              href={item.url}
              download
              target="_blank"
              rel="noreferrer"
              aria-label={`Baixar ${rotulo}`}
            >
              <Download size={14} strokeWidth={2} />
            </a>
            {/* Sem prompt não há receita para devolver ao composer nem texto
                para copiar — e aí o botão não existe, em vez de abrir um menu
                vazio. */}
            {prompt && (
              <button
                type="button"
                className="gal__botao-flutuante"
                aria-label={`Mais ações para ${rotulo}`}
                aria-haspopup="menu"
                aria-expanded={menuAberto}
                onMouseDown={evento => evento.stopPropagation()}
                onClick={evento => onAbrirMenu(item, evento.currentTarget.getBoundingClientRect())}
              >
                <MoreHorizontal size={14} strokeWidth={2} />
              </button>
            )}
          </span>

          <figcaption className="gal__legenda">{rotulo}</figcaption>
        </div>
      </div>
    </figure>
  );
}
