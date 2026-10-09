"use client";

/* ============================================================
   MEMÓRIA — a tela

   Não é uma página dentro do chrome claro: é um overlay
   `fixed inset-0` que cobre inclusive a barra lateral, como na
   referência. O `.dark` do bloco 08 vira aqui `.ms-memoria-dark`,
   que redeclara escala crua e camada semântica no mesmo `<div>`.

   Cabeçalho literal da tabela do `INFO.md`: voltar 36×36 em
   `left:16 top:16`, pílula de 36 de altura com `pl 10 / pr 6` e
   `gap 6`, alternador de visualização 36×36, segmentado de escopo
   centrado no topo e o interruptor em `right:16 top:16`.
   ============================================================ */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Brain, ChevronLeft, CircleQuestionMark, Network, Power } from "@/components/icones";
import { useSpaceSync } from "@/lib/useSpaceSync";
import { CHAVE_MEMORIA, GrafoMemoria } from "./GrafoMemoria";
import "./memoria.css";

/* 1,3px de traço em cada tamanho de ícone — `absoluteStrokeWidth`
   do lucide, os mesmos números do DOM da referência. */
const TRACO_18 = (1.3 * 24) / 18;   // 1.7333…
const TRACO_16 = (1.3 * 24) / 16;   // 1.95

/* ── A preferência do interruptor ──────────────────────────
   `localStorage` lido por `useSyncExternalStore`, e não por efeito:
   o servidor renderiza sempre "ligada", o cliente troca no primeiro
   commit e não há nem hidratação divergente nem render encadeado. */
const ouvintes = new Set<() => void>();
let cache: boolean | null = null;

function lerPreferencia() {
  if (cache === null) {
    try { cache = window.localStorage.getItem(CHAVE_MEMORIA) !== "0"; }
    catch { cache = true; }   // modo privado: fica ligada, que é o padrão
  }
  return cache;
}
function assinarPreferencia(avisar: () => void) {
  ouvintes.add(avisar);
  return () => { ouvintes.delete(avisar); };
}
function gravarPreferencia(valor: boolean) {
  cache = valor;
  try { window.localStorage.setItem(CHAVE_MEMORIA, valor ? "1" : "0"); } catch { /* idem */ }
  ouvintes.forEach(avisar => avisar());
}

export function Memoria() {
  const router = useRouter();
  // Mesma carga que as rotas de workflow fazem: sem ela, um navegador
  // novo veria a lista de projetos vazia até visitar /workflow.
  useSpaceSync();

  const memoriaLigada = React.useSyncExternalStore(assinarPreferencia, lerPreferencia, () => true);
  const [arvore, setArvore] = React.useState(false);
  const [ajuda, setAjuda] = React.useState(false);

  const alternarMemoria = React.useCallback(() => {
    gravarPreferencia(!lerPreferencia());
  }, []);

  return (
    <div className="mem-overlay ms-memoria-dark">
      <div className="relative flex h-full w-full flex-col overflow-hidden">
        <main className="relative min-h-0 flex-1 overflow-hidden">
          <GrafoMemoria memoriaLigada={memoriaLigada} arvore={arvore} />
        </main>

        {/* ── Cabeçalho ── */}
        <div className="absolute flex items-center" style={{ left: 16, top: 16, gap: 8, zIndex: 1800 }}>
          <button
            type="button"
            className="mem-btn mem-btn-flutuante mem-r-xl"
            onClick={() => router.back()}
            title="Voltar"
            aria-label="Voltar"
          >
            <ChevronLeft size={18} strokeWidth={TRACO_18} />
          </button>

          <div className="mem-pilula mem-r-xl">
            <Brain size={16} strokeWidth={TRACO_16} style={{ color: "var(--ms-icon-brand)" }} />
            <span>Memória pessoal</span>
            <button
              type="button"
              className="mem-btn mem-btn-fantasma mem-r-md"
              aria-label="O que o Pitch Studio lembra?"
              aria-expanded={ajuda}
              onClick={() => setAjuda(a => !a)}
            >
              <CircleQuestionMark size={16} strokeWidth={TRACO_16} />
            </button>
          </div>

          <button
            type="button"
            className="mem-btn mem-btn-flutuante mem-r-xl"
            aria-pressed={arvore}
            onClick={() => setArvore(a => !a)}
            title={arvore ? "Ver como grafo" : "Ver como mapa mental"}
            aria-label={arvore ? "Ver como grafo" : "Ver como mapa mental"}
          >
            <Network size={16} strokeWidth={TRACO_16} />
          </button>
        </div>

        {ajuda && (
          <div className="mem-ajuda mem-r-lg" role="note">
            <strong>O que esta tela lembra</strong>
            Nada é digitado aqui: o grafo lê o que você já acumulou no Pitch
            Studio — conversas, projetos, gerações e pastas. O contador de cada
            origem é a contagem real, e cada cartão abre o item de verdade.
          </div>
        )}

        {/* ── Escopo ──
            A referência alterna entre memória do projeto e pessoal. Esta
            leva entrega só a pessoal (mapa de afordâncias, bloco 08); a
            outra fica desenhada e desativada, com o motivo no `title`. */}
        <div className="mem-escopo mem-r-xl" role="tablist" aria-label="Escopo da memória">
          <button
            type="button"
            role="tab"
            aria-selected={false}
            disabled
            title="A memória por projeto chega numa próxima leva."
          >
            Memória do projeto
          </button>
          <button type="button" role="tab" aria-selected>
            Memória pessoal
          </button>
        </div>

        {/* ── Interruptor ──
            Com a memória desligada os "+ Adicionar" somem do DOM, como o
            `d && !k && <button>` da referência. */}
        <button
          type="button"
          className="mem-btn mem-btn-interruptor mem-r-xl absolute"
          style={{ right: 16, top: 16, zIndex: 1800 }}
          data-desligada={memoriaLigada ? "0" : "1"}
          aria-pressed={memoriaLigada}
          onClick={alternarMemoria}
        >
          <Power
            size={14}
            strokeWidth={1.5}
            className={memoriaLigada ? "mem-power-ligada" : "mem-power-desligada"}
          />
          <span style={{ fontSize: 12 }}>{memoriaLigada ? "Memória ligada" : "Memória desligada"}</span>
        </button>
      </div>
    </div>
  );
}
