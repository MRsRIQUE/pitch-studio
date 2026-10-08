"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PitchMark } from "@/components/PitchLogo";
import { useWorkflowStore, Toast } from "@/lib/store";
import "./superficies.css";

/* ============================================================
   TOASTS

   Portado do tema escuro do HeliosGen para a linguagem clara do
   Miora. A superfície virou branca (`--ms-bg`) com sombra e borda
   fina; o que continua colorido é só o sinal.

   Regra do kit de marca: cor de sinal só em texto, ícone e tinta
   a 14–18% — nunca em área grande. Por isso o toast simples é uma
   tinta do sinal a 14% sobre o branco, com o ícone no sinal cheio
   e o texto no cinza padrão. Nada de bloco chapado colorido.
   ============================================================ */

/* `color-mix` sobre o token do sinal em vez do hex cravado: se a
   escala de sinais mudar em `app/tokens/pitch.css`, o toast segue. */
const SINAIS: Record<Toast["type"], string> = {
  error: "var(--signal-critical)",
  success: "var(--signal-success)",
  info: "var(--signal-info)",
};

const ICONS: Record<Toast["type"], string> = {
  error:   "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
  success: "M20 6 9 17l-5-5",
  info:    "M12 16v-4m0-4h.01M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z",
};

function DismissButton({ onDismiss }: { onDismiss: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onDismiss}
      aria-label="Dispensar"
      className="shrink-0 cursor-pointer border-none bg-transparent p-0 leading-none text-ms-icon-tertiary transition-colors duration-150 hover:text-ms-icon"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

// Notificação rica no estilo macOS — usada quando o toast tem título + prévia
function RichToastItem({ toast, onDismiss, onClick }: { toast: Toast; onDismiss: (e: React.MouseEvent) => void; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="ms-superficie-entrada relative flex w-[340px] cursor-pointer items-center gap-3 rounded-ms-lg border border-ms-border-subtle bg-ms-bg p-3.5 shadow-ms-lg"
    >
      {/* Fechar — canto superior direito */}
      <button
        onClick={onDismiss}
        aria-label="Fechar notificação"
        className="absolute right-2 top-2 flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-ms-full border-none bg-ms-bg-component text-ms-icon-tertiary transition-colors duration-150 hover:bg-ms-bg-component-active hover:text-ms-icon"
      >
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Ícone do app */}
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-ms-md border border-ms-border-subtle bg-ms-bg-component">
        <PitchMark size={32} />
      </div>

      {/* Texto */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-3">
        <span className="truncate text-ms-md font-semibold leading-tight tracking-[-0.01em] text-ms-text">
          {toast.title}
        </span>
        <span className="truncate text-ms-base leading-snug text-ms-text-tertiary">
          {toast.preview}
        </span>
      </div>
    </div>
  );
}

// Toast simples — erros, informações, sucesso genérico
function SimpleToastItem({ toast, onDismiss, onClick }: { toast: Toast; onDismiss: (e: React.MouseEvent) => void; onClick: () => void }) {
  const sinal = SINAIS[toast.type];
  return (
    <div
      onClick={onClick}
      className="ms-superficie-entrada flex max-w-[360px] items-start gap-2.5 rounded-ms-md border p-3 shadow-ms-md"
      style={{
        // Tinta do sinal a 14% sobre o branco, borda do mesmo sinal a 32%:
        // dentro da faixa que o kit permite para superfície de sinal.
        background: `color-mix(in srgb, ${sinal} 14%, var(--ms-bg))`,
        borderColor: `color-mix(in srgb, ${sinal} 32%, transparent)`,
        cursor: toast.href ? "pointer" : "default",
      }}
    >
      <svg
        width="16" height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={sinal}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-px shrink-0"
      >
        <path d={ICONS[toast.type]} />
      </svg>
      <span className="flex-1 text-ms-md leading-relaxed text-ms-text">
        {toast.message}
      </span>
      <DismissButton onDismiss={onDismiss} />
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useWorkflowStore((s) => s.removeToast);
  const router = useRouter();
  const isRich = !!(toast.title && toast.preview);
  const dismissDuration = isRich ? null : toast.href ? 8000 : 4000;

  useEffect(() => {
    if (dismissDuration === null) return;
    const t = setTimeout(() => removeToast(toast.id), dismissDuration);
    return () => clearTimeout(t);
  }, [toast.id, removeToast, dismissDuration]);

  function handleClick() {
    if (toast.href) {
      removeToast(toast.id);
      router.push(toast.href);
    }
  }

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    removeToast(toast.id);
  }

  if (toast.title && toast.preview) {
    return <RichToastItem toast={toast} onDismiss={handleDismiss} onClick={handleClick} />;
  }

  return <SimpleToastItem toast={toast} onDismiss={handleDismiss} onClick={handleClick} />;
}

export default function Toaster() {
  const toasts = useWorkflowStore((s) => s.toasts);

  return (
    <div
      className="fixed right-6 top-6 z-[99999] flex flex-col gap-2"
      style={{ pointerEvents: toasts.length ? "auto" : "none" }}
    >
      {toasts.map((t) => <ToastItem key={t.id} toast={t} />)}
    </div>
  );
}
