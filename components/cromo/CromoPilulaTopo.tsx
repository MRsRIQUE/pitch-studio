"use client";

/**
 * A pílula do canto superior direito, servindo duas telas.
 *
 * É UM elemento em dois estados, os dois literais do `css-index-DtSFiOi0.css`:
 *
 *   `.is-collapsed` → pílula: `top/right 12`, `padding 8`, `gap 12`, `radius 18`
 *                     (48px de altura, porque os filhos têm 32)
 *   `.is-open`      → painel de 240px: `inset 8 8 8 auto`, `radius 18`
 *
 * Por isso ele anima `top/right/bottom/width` em `.24s cubic-bezier(.4,0,.2,1)`:
 * a pílula não some para dar lugar a outra caixa — ela cresce. Aberto, o
 * seletor de página sai do topo e vira a seção `Páginas`.
 *
 * `paginas` e `onCompartilhar` são OPCIONAIS: a tela que não tiver o
 * equivalente real simplesmente não passa, e o controle não é desenhado.
 * Botão morto é pior do que controle ausente.
 */

import type { ReactNode } from "react";
import { PanelLeftIcon, ChevronDown, Plus } from "@/components/icones";
import "./cromo.css";
import type { ItemCamada, Paginas, Vista } from "./CromoTipos";

export default function CromoPilulaTopo({
  vista,
  onVista,
  aberto,
  onAlternar,
  paginas,
  camadas,
  camadasTitulo = "Camadas",
  camadasVazio = "Nada nesta página",
  selecionado,
  onSelecionar,
  iniciais,
  onConta,
  onCompartilhar,
  extra,
}: {
  /** Um controle a mais na fila, antes do avatar — o Workflow põe os
      créditos aqui. Opcional pela mesma regra de `paginas`. */
  extra?: ReactNode;
  /** Qual das duas vistas está montada. Sem ela, o seletor não é desenhado. */
  vista?: Vista;
  /** Trocar de vista. Sem ele o seletor não é desenhado. */
  onVista?: (v: Vista) => void;
  aberto: boolean;
  onAlternar: () => void;
  /** Ausente quando a tela não tem páginas — ver o comentário do arquivo. */
  paginas?: Paginas;
  camadas: ItemCamada[];
  camadasTitulo?: string;
  camadasVazio?: string;
  selecionado?: string | null;
  onSelecionar?: (id: string) => void;
  /** Iniciais da conta: o avatar da referência é a foto real do usuário. */
  iniciais: string;
  onConta: () => void;
  onCompartilhar?: () => void;
}) {
  return (
    <div className={`cr-rs ${aberto ? "is-open" : "is-collapsed"}`}>
      <div className="cr-rs-top">
        {/* Um projeto, duas vistas — e desde a leva 7 uma TELA só. Trocar não
            navega mais: mostra ou esconde o painel de chat sobre o mesmo
            grafo. Era rota porque eram duas telas; virou estado porque a
            conversa passou a ser o grafo. */}
        {vista && onVista && (
          <div className="cr-vistas" role="tablist" aria-label="Vista do projeto">
            {(["conversa", "grafo"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={v === vista}
                className={`cr-vista${v === vista ? " is-active" : ""}`}
                onClick={() => v !== vista && onVista(v)}
              >
                {v === "conversa" ? "Conversa" : "Grafo"}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          className="cr-rs-top__toggle"
          aria-label={camadasTitulo}
          aria-expanded={aberto}
          title={camadasTitulo}
          onClick={onAlternar}
        >
          <PanelLeftIcon size={16} />
        </button>

        {/* Aberto, o seletor de página deixa o topo: ele virou a seção Páginas. */}
        {paginas && !aberto && (
          <button
            type="button"
            className="cr-rs-page-switcher"
            title="Páginas"
            aria-label={`Página ${paginas.atual} de ${paginas.lista.length}`}
            onClick={onAlternar}
          >
            <span>{paginas.lista.find((p) => p.numero === paginas.atual)?.rotulo ?? `Página ${paginas.atual}`}</span>
            <ChevronDown className="cr-rs-page-switcher__chevron" size={16} />
          </button>
        )}

        {extra}

        <button type="button" className="cr-avatar-btn" aria-label="Conta" title="Conta" onClick={onConta}>
          <span className="cr-avatar-mark" aria-hidden>
            {iniciais}
          </span>
        </button>

        {onCompartilhar && (
          <button type="button" className="cr-share" onClick={onCompartilhar}>
            Compartilhar
          </button>
        )}
      </div>

      {aberto && (
        <div className="cr-rs-body">
          {paginas && (
            <section className="cr-rs-section cr-rs-section--pages">
              <div className="cr-rs-section__header">
                <span className="cr-rs-section__title">Páginas</span>
                {paginas.onNova && (
                  <div className="cr-rs-section__actions">
                    <button
                      type="button"
                      className="cr-rs-icon-btn"
                      title="Nova página"
                      aria-label="Nova página"
                      onClick={paginas.onNova}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                )}
              </div>
              <div className="cr-rs-section__body">
                <ul className="cr-rs-page-list">
                  {paginas.lista.map((p) => (
                    <li key={p.numero} className={`cr-rs-page-item${p.numero === paginas.atual ? " is-active" : ""}`}>
                      <button
                        type="button"
                        className="cr-rs-page-item__label"
                        onClick={() => paginas.onTrocar(p.numero)}
                      >
                        {p.rotulo}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          <section className="cr-rs-section cr-rs-section--layers">
            <div className="cr-rs-section__header">
              <span className="cr-rs-section__title">{camadasTitulo}</span>
            </div>
            {/* A ordem de pintura é a do array; a camada de cima é a última,
                então a lista é invertida para ler de cima para baixo. */}
            {camadas.length === 0 ? (
              <div className="cr-layer-empty">{camadasVazio}</div>
            ) : (
              <div className="cr-layer-list">
                {[...camadas].reverse().map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`cr-layer-row${c.id === selecionado ? " is-active" : ""}`}
                    onClick={() => onSelecionar?.(c.id)}
                  >
                    {c.Icone && <c.Icone size={14} />}
                    <span>{c.rotulo}</span>
                    {c.detalhe && <em>{c.detalhe}</em>}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
