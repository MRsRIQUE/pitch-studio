"use client";

/* ============================================================
   TORRADEIRA DE DOWNLOAD

   Portada das linhas 5290–5392 de `app/gallery/page.tsx`, com a
   assinatura de props intacta.

   O bloco 07 não tem torradeira, então a superfície vem de onde
   o `INFO.md` manda ir quando falta captura: "a superfície aqui
   reproduz a do popover de modelos do bloco 03 — fundo
   `--app-v2-bg-surface`, raio 12, `--app-v2-shadow-floating`,
   entrada `opacity` + `scale(.96) translateY(-4px)` em 150 ms
   `cubic-bezier(.4,0,.2,1)`". É exatamente isso aqui.

   ── O que mudou além da cor ─────────────────────────────────
   O `DownloadTask` traz um `filename` que a versão escura nunca
   desenhava: a linha do item repetia em texto o mesmo estado que
   o ícone da direita já dizia ("Preparing…" ao lado de um giro,
   "Ready" ao lado de um check). Agora a linha mostra o NOME DO
   ARQUIVO — que é o dado real do modelo — e o estado fica só no
   ícone. Nada foi inventado; um campo que existia parou de ser
   jogado fora.
   ============================================================ */

import React, { useState } from "react";
import type { DownloadTask } from "@/components/gallery/tipos";
import "@/components/gallery/cartao.css";

const RAIO_DO_ARO = 12;
const PERIMETRO = 2 * Math.PI * RAIO_DO_ARO;

export function DownloadToast({ downloads, onClear }: { downloads: DownloadTask[]; onClear: () => void }) {
  const [collapsed, setCollapsed] = useState(false);

  if (downloads.length === 0) return null;

  const todosProntos = downloads.every(d => d.status !== "preparing");
  const titulo = todosProntos ? "Download concluído" : "Preparando download";

  return (
    <div
      className="acervo-entrada fixed right-4 top-16 z-[9500] w-[300px] overflow-hidden rounded-ms-lg border border-ms-border-subtle bg-ms-bg shadow-ms-md"
      role="status"
      aria-live="polite"
    >
      {/* ── Cabeçalho ──
          O × é irmão do gatilho de recolher, não filho: botão dentro de
          botão não é HTML válido. */}
      <div className="flex items-center pr-2.5">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        className="flex min-w-0 flex-1 select-none items-center gap-2.5 p-3.5 text-left transition-colors duration-150 hover:bg-ms-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ms-ring"
      >
        {/* Aro de progresso indeterminado */}
        <div className="relative size-7 shrink-0">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="absolute inset-0" aria-hidden>
            <circle cx="14" cy="14" r={RAIO_DO_ARO} stroke="var(--ms-border-subtle)" strokeWidth="2" />
            <circle
              cx="14"
              cy="14"
              r={RAIO_DO_ARO}
              stroke="var(--brand-violet)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={PERIMETRO}
              strokeDashoffset={todosProntos ? 0 : PERIMETRO * 0.25}
              style={{ transformOrigin: "center", transform: "rotate(-90deg)", transition: "stroke-dashoffset 400ms ease" }}
              className={todosProntos ? undefined : "acervo-aro-girando"}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--brand-violet)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
        </div>

        <span className="min-w-0 flex-1 truncate text-ms-lg font-semibold text-ms-text">{titulo}</span>

        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          className="shrink-0 text-ms-icon-tertiary transition-transform duration-200"
          style={{ transform: collapsed ? "rotate(180deg)" : undefined }}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* A página já dispensa sozinha 4 s depois que tudo termina; este
          botão é só o atalho para quem não quer esperar. */}
      <button
        type="button"
        onClick={onClear}
        aria-label="Dispensar"
        title="Dispensar"
        className="flex size-6 shrink-0 items-center justify-center rounded-ms text-ms-icon-tertiary transition-colors duration-150 hover:bg-ms-bg-hover hover:text-ms-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-ring"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      </div>

      {/* ── Itens ── */}
      {!collapsed && (
        <div className="px-2 pb-2">
          {downloads.map(task => (
            <div
              key={task.id}
              className="mb-1 flex items-center gap-2.5 rounded-ms-md bg-ms-bg-component px-2.5 py-2.5"
            >
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                className={"shrink-0 " + (task.status === "preparing" ? "text-ms-icon-disabled" : "text-ms-icon-tertiary")}
                aria-hidden
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
                <rect x="2" y="4" width="20" height="16" rx="2" />
              </svg>

              <span
                title={task.filename}
                className={"min-w-0 flex-1 truncate text-ms-md " + (task.status === "preparing" ? "text-ms-text-tertiary" : "text-ms-text")}
              >
                {task.filename}
              </span>

              {task.status === "preparing" ? (
                <span className="acervo-giro acervo-giro--marca" style={{ width: 16, height: 16, borderWidth: 2 }} aria-label="Preparando" />
              ) : task.status === "error" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--signal-critical)" strokeWidth="2" strokeLinecap="round" className="shrink-0" aria-label="Falhou">
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                </svg>
              ) : (
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-ms-full"
                  style={{ background: "var(--brand-violet)" }}
                  aria-label="Pronto"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-ms-text-on-brand">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
