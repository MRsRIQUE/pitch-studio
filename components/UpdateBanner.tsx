"use client";
import { useEffect, useState } from "react";
import "./superficies.css";

/**
 * Faixa "atualização disponível", agora na linguagem clara do Miora.
 * Consulta `/api/update-check` (último release do GitHub contra a versão
 * embutida); clicar na faixa abre um modal com as notas e o link de
 * download. Não instala nada — Baixar só abre a página do release no
 * navegador do sistema (capturado por {@link DesktopLinkHandler}).
 */

const DISMISS_KEY = "pitch-studio-update-dismissed"; // guarda a versão que o usuário dispensou

/* O sinal de aviso do kit (`--signal-warning`, #FFB547) no lugar do âmbar
   cravado que veio do HeliosGen. Sobre fundo claro ele só pinta ícone,
   marcador e tinta de fundo — como texto reprovaria em contraste, então o
   texto fica no cinza padrão. */
const AVISO = "var(--signal-warning)";

type UpdateInfo = {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion?: string;
  name?: string;
  notes?: string;
  url?: string;
  publishedAt?: string;
};

export default function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/update-check")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: UpdateInfo | null) => {
        if (!alive || !d?.updateAvailable) return;
        try {
          if (localStorage.getItem(DISMISS_KEY) === d.latestVersion) setDismissed(true);
        } catch {
          /* modo privativo — apenas mostra */
        }
        setInfo(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!info?.updateAvailable || dismissed) return null;

  const dismiss = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    try {
      if (info.latestVersion) localStorage.setItem(DISMISS_KEY, info.latestVersion);
    } catch {
      /* ignora */
    }
    setDismissed(true);
  };

  const faixaRepouso = `color-mix(in srgb, ${AVISO} 16%, var(--ms-bg))`;
  const faixaHover = `color-mix(in srgb, ${AVISO} 26%, var(--ms-bg))`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full shrink-0 cursor-pointer items-center justify-center gap-2 border-none px-4 py-[9px] transition-colors duration-150"
        style={{
          background: faixaRepouso,
          borderBottom: `1px solid color-mix(in srgb, ${AVISO} 34%, transparent)`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = faixaHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = faixaRepouso;
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={AVISO}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span className="text-ms-base font-medium text-ms-text">
          Atualização disponível{info.latestVersion ? ` — ${info.latestVersion}` : ""}
        </span>
        <span
          className="ml-1 rounded-ms border bg-ms-bg px-2 py-0.5 text-ms-sm font-semibold text-ms-text-secondary"
          style={{ borderColor: `color-mix(in srgb, ${AVISO} 40%, transparent)` }}
        >
          Ver mudanças →
        </span>
        <span
          role="button"
          tabIndex={0}
          aria-label="Dispensar"
          onClick={dismiss}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") dismiss(e);
          }}
          className="ml-2 flex h-[18px] w-[18px] items-center justify-center rounded-ms text-ms-icon-tertiary transition-colors duration-150 hover:bg-ms-bg-hover hover:text-ms-icon"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </span>
      </button>

      {open && <ChangelogModal info={info} onClose={() => setOpen(false)} />}
    </>
  );
}

function ChangelogModal({ info, onClose }: { info: UpdateInfo; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-[9999] bg-ms-bg-overlay" />
      <div
        role="dialog"
        aria-modal="true"
        className="ms-superficie-entrada fixed left-1/2 top-1/2 z-[10000] flex max-h-[min(80vh,640px)] w-[min(90vw,560px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-ms-xl border border-ms-border-subtle bg-ms-bg shadow-ms-lg"
      >
        {/* Cabeçalho */}
        <div className="flex items-center gap-2.5 border-b border-ms-border-subtle px-5 py-[18px]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={AVISO} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className="min-w-0 flex-1">
            <div className="text-ms-lg font-semibold text-ms-text">
              {info.name || "Atualização disponível"}
            </div>
            <div className="mt-0.5 text-ms-sm text-ms-text-tertiary">
              {info.currentVersion} → {info.latestVersion}
              {info.publishedAt ? ` · ${new Date(info.publishedAt).toLocaleDateString("pt-BR")}` : ""}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-ms-md border-none bg-transparent text-ms-icon-tertiary transition-colors duration-150 hover:bg-ms-bg-hover hover:text-ms-icon"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Notas */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <Notes text={info.notes || "Nenhuma nota de versão foi publicada."} />
        </div>

        {/* Rodapé */}
        <div className="flex justify-end gap-2 border-t border-ms-border-subtle px-5 py-3.5">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-ms-md border border-ms-border bg-ms-bg px-3.5 py-[7px] text-ms-base font-medium text-ms-text-secondary transition-colors duration-150 hover:bg-ms-bg-hover"
          >
            Depois
          </button>
          {/* Sem target="_blank": o DesktopLinkHandler intercepta o clique e
              entrega a URL ao navegador do sistema via /api/open-external. Um
              _blank também dispararia o shell.open (sem permissão) do Tauri. */}
          <a
            href={info.url}
            onClick={onClose}
            className="cursor-pointer rounded-ms-md bg-ms-solid-brand px-3.5 py-[7px] text-ms-base font-semibold text-ms-text-on-solid no-underline shadow-ms-button transition-shadow duration-150 hover:shadow-ms-button-hover"
          >
            Baixar
          </a>
        </div>
      </div>
    </>
  );
}

/** Renderizador mínimo e seguro de "Markdown" para o corpo de um release. */
function Notes({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  return (
    <div className="text-ms-md leading-relaxed text-ms-text-secondary">
      {lines.map((raw, i) => {
        const line = raw.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`(.+?)`/g, "$1");
        const heading = line.match(/^#{1,6}\s+(.*)/);
        if (heading) {
          return (
            <div key={i} className={i ? "mb-1 mt-3 font-semibold text-ms-text" : "mb-1 font-semibold text-ms-text"}>
              {heading[1]}
            </div>
          );
        }
        const bullet = line.match(/^\s*[-*]\s+(.*)/);
        if (bullet) {
          return (
            <div key={i} className="flex gap-2 py-px">
              <span className="text-ms-text-tertiary">•</span>
              <span>{bullet[1]}</span>
            </div>
          );
        }
        if (!line.trim()) return <div key={i} className="h-2" />;
        return (
          <div key={i} className="py-px">
            {line}
          </div>
        );
      })}
    </div>
  );
}
