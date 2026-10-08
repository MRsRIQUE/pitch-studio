"use client";

/* ============================================================
   As peças da barra do composer.

   Três formas, e só três — é o que dá o ritmo do bloco 03: botão de
   ícone de 24x24, pílula de 24 de altura e segmento de N estados.
   Qualquer controle novo entra numa delas, ou está errado.

   Nenhuma sabe o que representa. Quem decide é o consumidor.
   ============================================================ */

import * as React from "react";
import "@/app/gallery/composer.css";

/* ── Botão de ícone (24x24) ───────────────────────────────── */

export const ComposerIconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { open?: boolean; label: string }
>(function ComposerIconButton({ open, label, className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={`pc-icon-btn${className ? ` ${className}` : ""}`}
      data-open={open ? "true" : undefined}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  );
});

/* ── Pílula ───────────────────────────────────────────────── */

export const ComposerPill = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    /** Estado fora do padrão — a referência tinge a pílula de marca. */
    custom?: boolean;
    /** Some com a seta quando a pílula não abre nada. */
    chevron?: boolean;
  }
>(function ComposerPill({ custom, chevron = true, className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={`pc-pill${className ? ` ${className}` : ""}`}
      data-custom={custom ? "true" : undefined}
      {...rest}
    >
      {children}
      {chevron && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      )}
    </button>
  );
});

/** O separador entre valores resumidos numa pílula: `1:1 · 2K · ×1`. */
export function PillSep() {
  return <span className="pc-pill-sep">·</span>;
}

/** A seta da pílula. Existe solta porque o gatilho do menu é um
    `<button>` do Base UI estilizado com `.pc-pill`, e não a
    `ComposerPill` embrulhada — a primitiva não aceita `asChild`. */
export function PillChevron() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="shrink-0 transition-transform duration-150 group-data-[popup-open]:rotate-180"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/* ── Segmento de N estados ────────────────────────────────── */

export function ComposerSegment<T extends string>({
  value,
  onChange,
  options,
  disabled,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className="pc-segment" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="pc-segment-item"
          data-active={o.value === value ? "true" : undefined}
          aria-pressed={o.value === value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Linha de parâmetro dentro do popover ─────────────────── */

export function ParamRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pc-param-row">
      <span className="pc-param-label">{label}</span>
      {children}
    </div>
  );
}

export function ParamSep() {
  return <div className="pc-param-sep" role="separator" />;
}

/* ── Ícones da fila esquerda ──────────────────────────────── */
/* Os `<path>` são os literais do `page-home.html` da referência, com a
   exceção anotada no INFO.md: `Polish prompt` usa uma fonte de ícones
   própria do Miora, ausente da captura, e ali já vinha substituída
   pelo equivalente do lucide na mesma caixa de 16px. */

const icon = (children: React.ReactNode, strokeWidth = 1.5) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const IconAttach = () =>
  icon(
    <path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551" />,
    1.95,
  );

export const IconMention = () =>
  icon(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
    </>,
    1.95,
  );

export const IconPolish = () =>
  icon(
    <>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
    </>,
    1.3,
  );
