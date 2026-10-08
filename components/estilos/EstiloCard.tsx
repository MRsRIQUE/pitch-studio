"use client";

/* ============================================================
   CARTÃO DE ESTILO — `.skills-v2-installed-card`

   Estrutura um-para-um com o `component.tsx` da referência: ícone 64×64,
   `__info` com `__title-row` (grupo nome + versão à esquerda, More + toggle à
   direita), a `__status-row` reservada e a descrição com `line-clamp:2`.

   O que cada afordância faz aqui:
   - **toggle** — liga o estilo. Desligado, ele continua guardado mas não é
     oferecido ao composer nem à linha de especialistas.
   - **versão** — a versão local, que sobe a cada edição salva.
   - **status-row** — o selo `Modified` da referência: "editado".
   - **More** — Editar / Exportar / Excluir, os três rótulos da referência.
     Entra um quarto, **Aplicar no Criar**: é a nossa ação que manda o fragmento
     para o composer, e sem ele ela não teria porta nenhuma nesta tela.
   - **clique no cartão** — abre o estilo, como o `role="button"` de lá.
   ============================================================ */

import * as React from "react";
import { Pencil, Copy, Download, Trash2, Wand2 } from "@/components/icones";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconMais } from "@/components/estilos/icons";
import type { Estilo } from "@/lib/estilosStore";

export function EstiloCard({
  estilo,
  onOpen,
  onToggle,
  onApply,
  onEdit,
  onDuplicate,
  onExport,
  onRemove,
}: {
  estilo: Estilo;
  onOpen: (estilo: Estilo) => void;
  onToggle: (estilo: Estilo, next: boolean) => void;
  onApply: (estilo: Estilo) => void;
  onEdit: (estilo: Estilo) => void;
  onDuplicate: (estilo: Estilo) => void;
  onExport: (estilo: Estilo) => void;
  onRemove: (estilo: Estilo) => void;
}) {
  const monogram = estilo.name.trim().slice(0, 1) || "E";
  const state = estilo.enabled ? "checked" : "unchecked";

  return (
    <article
      className="est-card"
      role="button"
      tabIndex={0}
      data-enabled={estilo.enabled}
      onClick={() => onOpen(estilo)}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(estilo);
        }
      }}
    >
      <div className="est-card__mark" aria-hidden>{monogram}</div>

      <div className="est-card__info">
        <div className="est-card__title-row">
          <div className="est-card__title-group">
            <p className="est-card__name" title={estilo.name}>{estilo.name}</p>
            <span className="est-card__version">{estilo.version}</span>
          </div>

          <div className="est-card__actions" onClick={event => event.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="est-card__menu"
                aria-label={`Mais ações de ${estilo.name}`}
                title="Mais"
              >
                <IconMais />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4} className="min-w-40 rounded-ms-lg">
                <DropdownMenuItem className="cursor-pointer text-ms-base" onClick={() => onApply(estilo)}>
                  <Wand2 size={14} strokeWidth={1.5} /> Aplicar no Criar
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer text-ms-base" onClick={() => onEdit(estilo)}>
                  <Pencil size={14} strokeWidth={1.5} /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer text-ms-base" onClick={() => onDuplicate(estilo)}>
                  <Copy size={14} strokeWidth={1.5} /> Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer text-ms-base" onClick={() => onExport(estilo)}>
                  <Download size={14} strokeWidth={1.5} /> Exportar
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  className="cursor-pointer text-ms-base"
                  onClick={() => onRemove(estilo)}
                >
                  <Trash2 size={14} strokeWidth={1.5} /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* `role="switch"` + `data-state`, a mesma marcação do `rcui-switch`
                da referência — é o `data-state` que o CSS lê. */}
            <button
              type="button"
              role="switch"
              aria-checked={estilo.enabled}
              data-state={state}
              className="est-switch"
              aria-label={`${estilo.enabled ? "Desligar" : "Ligar"} ${estilo.name}`}
              onClick={() => onToggle(estilo, !estilo.enabled)}
            >
              <span data-state={state} className="est-switch__thumb" />
            </button>
          </div>
        </div>

        {estilo.isModified && (
          <div className="est-card__status-row">
            <span>editado</span>
          </div>
        )}

        <p className="est-card__fragment">{estilo.fragment}</p>
      </div>
    </article>
  );
}
