"use client";

/* ============================================================
   A SEGUNDA PÍLULA — os parâmetros dependentes do modelo

   Na referência esta é a pílula `Auto`, que dobra o modo do agente e o
   seletor multimodal atrás de um popover. Aqui ela dobra os nove
   parâmetros que hoje ocupam ~380 linhas de barra horizontal:
   proporção, qualidade, resolução, quantidade, duração, modo, som,
   referências e seed.

   O componente não sabe quais parâmetros existem — quem declara é o
   consumidor, conforme o modelo escolhido. É o que garante que uma
   linha nunca apareça para um modelo que não a suporta, e que o resumo
   da pílula nunca afirme um valor que não está em jogo.

   O raio, a sombra e a animação de entrada vêm de
   `components/ui/dropdown-menu`, que a fundação já acertou.
   ============================================================ */

import * as React from "react";
import { Check, ChevronDown } from "@/components/icones";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ParamRow, PillChevron, PillSep } from "./ComposerControls";
import "@/app/gallery/composer.css";

/** Um parâmetro. A forma do controle sai do `kind`. */
export type ParamField =
  /** Lista de opções: proporção, qualidade, resolução, modo. */
  | {
      kind: "select";
      id: string;
      label: string;
      value: string;
      options: { value: string; label: string }[];
      onChange: (value: string) => void;
    }
  /** Passo em lista fechada: duração (5s, 8s, 10s…). */
  | {
      kind: "steps";
      id: string;
      label: string;
      value: number;
      steps: number[];
      suffix?: string;
      onChange: (value: number) => void;
    }
  /** Passo contínuo entre limites: quantidade. */
  | {
      kind: "stepper";
      id: string;
      label: string;
      value: number;
      min: number;
      max: number;
      onChange: (value: number) => void;
    }
  /** Liga/desliga: som. */
  | {
      kind: "toggle";
      id: string;
      label: string;
      value: boolean;
      onChange: (value: boolean) => void;
    }
  /** Dois estados nomeados: quadros × referências, no Veo. */
  | {
      kind: "choice";
      id: string;
      label: string;
      value: string;
      options: { value: string; label: string }[];
      onChange: (value: string) => void;
    }
  /** Inteiro digitado: seed. */
  | {
      kind: "number";
      id: string;
      label: string;
      value: number;
      min: number;
      max: number;
      onChange: (value: number) => void;
    }
  /** Escape para o que não cabe nas formas acima. */
  | { kind: "custom"; id: string; label: string; node: React.ReactNode };

export function ParamsPill({
  fields,
  summary,
  disabled,
  label = "Parâmetros de geração",
}: {
  fields: ParamField[];
  /** Os valores vivos, na ordem em que aparecem na pílula. */
  summary: string[];
  disabled?: boolean;
  label?: string;
}) {
  if (fields.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="pc-pill group" aria-label={label} disabled={disabled}>
        {summary.map((s, i) => (
          <React.Fragment key={s + i}>
            {i > 0 && <PillSep />}
            <span>{s}</span>
          </React.Fragment>
        ))}
        <PillChevron />
      </DropdownMenuTrigger>

      {/* `side="top"`: o composer vive no rodapé, então o popover cresce
          para cima com a borda de baixo parada, como na referência. */}
      <DropdownMenuContent
        side="top"
        align="end"
        sideOffset={12}
        className="w-[250px] p-2"
      >
        {fields.map((f) => (
          <ParamFieldRow key={f.id} field={f} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Uma linha de parâmetro. Exportada porque o popover do agente passou
    a hospedá-la: na referência tudo mora atrás do `Auto`. */
export function ParamFieldRow({ field }: { field: ParamField }) {
  switch (field.kind) {
    case "custom":
      /* Empilhado: um editor com varias linhas nao cabe na coluna da
         direita de uma linha de 32px. */
      return (
        <div className="flex flex-col gap-1 py-1">
          <span className="px-2 text-ms-base text-ms-text-secondary">{field.label}</span>
          {field.node}
        </div>
      );

    case "select":
      return (
        <ParamRow label={field.label}>
          <InlineSelect
            value={field.value}
            options={field.options}
            onChange={field.onChange}
            label={field.label}
          />
        </ParamRow>
      );

    case "choice":
      return (
        <ParamRow label={field.label}>
          <div className="pc-segment">
            {field.options.map((o) => (
              <button
                key={o.value}
                type="button"
                className="pc-segment-item"
                data-active={o.value === field.value ? "true" : undefined}
                aria-pressed={o.value === field.value}
                onClick={() => field.onChange(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </ParamRow>
      );

    case "steps": {
      const i = Math.max(0, field.steps.indexOf(field.value));
      return (
        <ParamRow label={field.label}>
          <Stepper
            text={`${field.value}${field.suffix ?? ""}`}
            canDown={i > 0}
            canUp={i < field.steps.length - 1}
            onDown={() => field.onChange(field.steps[i - 1])}
            onUp={() => field.onChange(field.steps[i + 1])}
            label={field.label}
          />
        </ParamRow>
      );
    }

    case "stepper":
      return (
        <ParamRow label={field.label}>
          <Stepper
            text={String(field.value)}
            canDown={field.value > field.min}
            canUp={field.value < field.max}
            onDown={() => field.onChange(field.value - 1)}
            onUp={() => field.onChange(field.value + 1)}
            label={field.label}
          />
        </ParamRow>
      );

    case "toggle":
      return (
        <ParamRow label={field.label}>
          <button
            type="button"
            role="switch"
            aria-checked={field.value}
            aria-label={field.label}
            onClick={() => field.onChange(!field.value)}
            className={
              "relative h-4 w-7 shrink-0 rounded-ms-full transition-colors duration-150 " +
              (field.value ? "bg-ms-solid-brand" : "bg-ms-bg-component-active")
            }
          >
            <span
              className={
                "absolute top-0.5 size-3 rounded-full bg-ms-bg transition-[left] duration-150 " +
                (field.value ? "left-3.5" : "left-0.5")
              }
            />
          </button>
        </ParamRow>
      );

    case "number":
      return (
        <ParamRow label={field.label}>
          <input
            type="number"
            min={field.min}
            max={field.max}
            value={field.value}
            aria-label={field.label}
            onChange={(e) => {
              const n = e.target.value === "" ? field.min : parseInt(e.target.value, 10);
              if (Number.isNaN(n)) return;
              field.onChange(Math.max(field.min, Math.min(field.max, n)));
            }}
            className="seed-input w-[72px] rounded-ms border border-ms-border-subtle bg-ms-bg-component px-2 py-0.5 text-right text-ms-base tabular-nums text-ms-text outline-none focus-visible:ring-2 focus-visible:ring-ms-ring"
          />
        </ParamRow>
      );
  }
}

/** O menu de uma linha. Aninhado dentro do popover de parâmetros. */
function InlineSelect({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  label: string;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="group flex h-6 min-w-[88px] items-center gap-1 rounded-ms border border-ms-border-subtle bg-ms-bg px-2 text-ms-base text-ms-text transition-colors duration-150 hover:bg-ms-bg-hover data-[state=open]:bg-ms-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ms-ring"
      >
        <span className="truncate">{current?.label ?? value}</span>
        <ChevronDown
          size={12}
          strokeWidth={2.5}
          className="ml-auto shrink-0 text-ms-icon-secondary transition-transform duration-150 group-data-[state=open]:rotate-180"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" sideOffset={10} className="min-w-[160px]">
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={
                "flex h-8 w-full items-center justify-between gap-4 rounded-ms px-2 text-ms-base transition-colors hover:bg-ms-bg-hover " +
                (checked ? "font-semibold text-ms-text-brand" : "text-ms-text")
              }
            >
              <span className="truncate">{o.label}</span>
              {checked && <Check size={14} strokeWidth={2.2} className="shrink-0 text-ms-icon-brand" />}
            </button>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** − valor + , na caixa de 24 de altura do composer. */
function Stepper({
  text,
  canDown,
  canUp,
  onDown,
  onUp,
  label,
}: {
  text: string;
  canDown: boolean;
  canUp: boolean;
  onDown: () => void;
  onUp: () => void;
  label: string;
}) {
  return (
    <div
      className="flex h-6 shrink-0 items-center overflow-hidden rounded-ms border border-ms-border-subtle bg-ms-bg-component"
      role="group"
      aria-label={label}
    >
      <StepperButton onClick={onDown} disabled={!canDown} label={`Diminuir ${label}`}>
        −
      </StepperButton>
      <span className="min-w-10 text-center text-ms-base tabular-nums text-ms-text">{text}</span>
      <StepperButton onClick={onUp} disabled={!canUp} label={`Aumentar ${label}`}>
        +
      </StepperButton>
    </div>
  );
}

function StepperButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-6 w-6 shrink-0 items-center justify-center text-ms-md text-ms-text-secondary transition-colors hover:bg-ms-bg-component-hover disabled:cursor-default disabled:text-ms-text-disabled disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
