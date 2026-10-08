"use client";

/**
 * A barra do canto inferior direito, servindo duas telas.
 *
 * `.design-view-toolbar.is-floating`: `right/bottom 12`, `radius 18`, inner com
 * `padding 6` e `gap 8`. Os ícones ficam em `gap: 0` — 32px encostados — e só
 * depois vem o zoom.
 *
 * Os alternadores são OPCIONAIS. A tela que não tiver o equivalente real
 * simplesmente não passa o par valor/callback, e o botão não é desenhado:
 * em `/workflow` o canvas é do `@xyflow/react` e não tem fundo trocável,
 * `snapToGrid` nem minimapa — botão morto é pior do que controle ausente.
 *
 * O zoom NÃO é calculado aqui: quem sabe o zoom é o dono do canvas. Em
 * `/projeto` é a câmera do plano; em `/workflow` é o viewport do xyflow.
 */

import { useEffect, useRef, useState } from "react";
import { Square, Keyboard, LayoutGrid, Map, ChevronDown, X } from "@/components/icones";
import "./cromo.css";
import { FUNDOS_CANVAS, type GrupoAtalhos } from "./CromoTipos";

/** Os quatro itens do menu de zoom, na ordem do bundle. */
const ZOOMS: [string, number | "fit"][] = [
  ["Ajustar à tela", "fit"],
  ["Zoom 200%", 2],
  ["Zoom 100%", 1],
  ["Zoom 50%", 0.5],
];

type MenuAberto = null | "fundo" | "zoom";

export default function CromoBarraVisualizacao({
  zoom,
  onZoom,
  onAjustar,
  atalhos,
  gruposAtalhos,
  alinhar,
  onAlinhar,
  minimapa,
  onMinimapa,
  fundo,
  onFundo,
}: {
  zoom: number;
  onZoom: (z: number) => void;
  onAjustar: () => void;
  /** O painel de atalhos é da barra; a lista vem de quem sabe as teclas. */
  gruposAtalhos: GrupoAtalhos[];
  atalhos?: boolean;
  alinhar?: boolean;
  onAlinhar?: () => void;
  minimapa?: boolean;
  onMinimapa?: () => void;
  fundo?: string;
  onFundo?: (cor: string) => void;
}) {
  const [menu, setMenu] = useState<MenuAberto>(null);
  const [caixa, setCaixa] = useState<DOMRect | null>(null);
  const [atalhosAberto, setAtalhosAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  /* O painel de atalhos pode ser controlado de fora (a tela decide) ou pela
     própria barra. Sem a prop, ele é nosso. */
  const painelAberto = atalhos ?? atalhosAberto;

  /* Clicar fora fecha — é o `closeMenus` da referência, que corre em todo
     clique que não seja no próprio gatilho. */
  useEffect(() => {
    if (!menu) return;
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setMenu(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  useEffect(() => {
    if (!painelAberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAtalhosAberto(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [painelAberto]);

  const abrir = (qual: MenuAberto, alvo: HTMLElement) => {
    setCaixa(alvo.getBoundingClientRect());
    setMenu((atual) => (atual === qual ? null : qual));
  };

  /* O menu sobe a partir do gatilho: a barra vive colada no rodapé, então
     abrir para baixo sairia da tela. */
  const posicao = (altura: number) =>
    caixa ? { left: Math.max(12, caixa.left - 40), top: Math.max(12, caixa.top - altura) } : undefined;

  return (
    <>
      <div className="cr-view-toolbar" ref={raiz}>
        <div className="cr-view-toolbar__inner">
          <div className="cr-view-toolbar__icons">
            {onFundo && (
              <button
                type="button"
                title="Fundo do canvas"
                aria-label="Fundo do canvas"
                aria-expanded={menu === "fundo"}
                onClick={(e) => abrir("fundo", e.currentTarget)}
              >
                <Square size={16} />
              </button>
            )}
            <button
              type="button"
              title="Atalhos"
              aria-label="Atalhos"
              aria-pressed={painelAberto}
              onClick={() => setAtalhosAberto((v) => !v)}
            >
              <Keyboard size={16} />
            </button>
            {onAlinhar && (
              <button
                type="button"
                title="Alinhar à grade"
                aria-label="Alinhar à grade"
                aria-pressed={alinhar}
                onClick={onAlinhar}
              >
                <LayoutGrid size={16} />
              </button>
            )}
            {onMinimapa && (
              <button
                type="button"
                title="Minimapa"
                aria-label="Minimapa"
                aria-pressed={minimapa}
                onClick={onMinimapa}
              >
                <Map size={16} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="cr-zoom"
            title="Zoom"
            aria-expanded={menu === "zoom"}
            onClick={(e) => abrir("zoom", e.currentTarget)}
          >
            <span>{Math.round(zoom * 100)}%</span>
            <ChevronDown size={16} />
          </button>
        </div>

        {menu === "fundo" && onFundo && (
          <div className="cr-menu" style={posicao(150)} role="menu" aria-label="Fundo do canvas">
            {FUNDOS_CANVAS.map((cor) => (
              <button
                key={cor}
                type="button"
                role="menuitemradio"
                aria-checked={cor === fundo}
                onClick={() => {
                  onFundo(cor);
                  setMenu(null);
                }}
              >
                <span className="cr-menu__sw" style={{ background: cor }} />
                <span>{cor}</span>
              </button>
            ))}
          </div>
        )}

        {menu === "zoom" && (
          <div className="cr-menu" style={posicao(152)} role="menu" aria-label="Zoom">
            {ZOOMS.map(([rotulo, valor]) => (
              <button
                key={rotulo}
                type="button"
                role="menuitem"
                onClick={() => {
                  if (valor === "fit") onAjustar();
                  else onZoom(valor);
                  setMenu(null);
                }}
              >
                {rotulo}
              </button>
            ))}
          </div>
        )}
      </div>

      {painelAberto && (
        <div className="cr-shortcuts" role="dialog" aria-label="Atalhos">
          <button
            type="button"
            className="cr-shortcuts__close"
            aria-label="Fechar"
            onClick={() => setAtalhosAberto(false)}
          >
            <X size={16} />
          </button>
          <div className="cr-shortcuts__cols">
            {([0, 1, 2] as const).map((coluna) => (
              <div key={coluna}>
                {gruposAtalhos
                  .filter((g) => g.coluna === coluna)
                  .map((g) => (
                    <div key={g.titulo}>
                      <h4>{g.titulo}</h4>
                      <dl>
                        {g.itens.map((it) => (
                          <div className="r" key={it.acao}>
                            <span>{it.acao}</span>
                            <span className="k">
                              {it.teclas.map((t, i) => (
                                <kbd className="cr-key" key={`${t}-${i}`}>
                                  {t}
                                </kbd>
                              ))}
                            </span>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
