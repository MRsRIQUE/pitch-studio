"use client";

/**
 * A barra vertical de ferramentas do bloco 09, servindo duas telas.
 *
 * Montagem literal de `js/index-7OglJPbh.js`, pela §3 do `INFO.md`: cápsulas
 * brancas de `radius 999px` com `padding 6` e `gap 8`, botões de 32×32
 * (passo de 40), ícones de 16×16, e a tooltip com rótulo E tecla na mesma
 * caixa, à direita, com `sideOffset 14`.
 *
 * O que muda entre as telas é só o conteúdo de `capsulas`. A referência tem
 * duas; em `/workflow` a segunda cápsula carrega dois blocos separados pelo
 * traço de 24×1px — o segundo é nosso (Desfazer/Refazer/Exportar) e o traço
 * é o que deixa isso explícito.
 */

import "./cromo.css";
import type { CapsulaFerramentas } from "./CromoTipos";

export default function CromoBarraFerramentas({ capsulas }: { capsulas: CapsulaFerramentas[] }) {
  return (
    <div className="cr-toolbar" data-canvas-toolbar="left">
      <div className="cr-toolbar-groups">
        {capsulas.map((capsula) => (
          <div key={capsula.chave} className="cr-toolbar-group" role="toolbar" aria-label={capsula.rotulo}>
            {capsula.blocos.map((bloco, i) => (
              <div key={i} style={{ display: "contents" }}>
                {/* O traço só existe ENTRE blocos: o primeiro não leva. */}
                {i > 0 && <span className="cr-toolbar-traco" aria-hidden />}
                {bloco.map((item) => (
                  <button
                    key={item.chave}
                    type="button"
                    className={`${item.ativo ? "is-active " : ""}${item.menu ? "cr-has-dropdown" : ""}`}
                    aria-pressed={item.ativo}
                    aria-label={item.rotulo}
                    disabled={item.desabilitado}
                    title={item.desabilitado ? item.motivo : undefined}
                    onClick={(e) => item.onClick(e.currentTarget.getBoundingClientRect())}
                  >
                    <item.Icone size={16} />
                    <span className="cr-tip">
                      {item.rotulo}
                      {item.tecla && <kbd>{item.tecla}</kbd>}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
