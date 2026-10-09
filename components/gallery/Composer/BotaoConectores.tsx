"use client";

/* ============================================================
   BOTÃO 3 — CONECTORES

   Na referência abre a lista de apps externos (Notion, Figma, Bitable,
   GitHub). Aqui abre a lista dos nossos três provedores de geração,
   com o estado real da chave de cada um e o caminho para arrumá-la.

   O botão não conecta nada sozinho — o modal de ajustes é quem guarda
   chave, e ele não é meu. Este é o atalho para lá, com o diagnóstico
   ao lado de cada linha.
   ============================================================ */

import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProvedores } from "./useProvedores";
import "@/app/gallery/composer.css";

/** `<path>` literal do `page-home.html` — o ícone de nós da referência. */
function IconeConectores() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.95" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 19a1 1 0 0 1-1-1v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1z" />
      <path d="M17 21v-2" />
      <path d="M19 14V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V10" />
      <path d="M21 21v-2" />
      <path d="M3 5V3" />
      <path d="M4 10a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2z" />
      <path d="M7 5V3" />
    </svg>
  );
}

export function BotaoConectores({
  aoAbrirAjustes,
  positionerClassName,
}: {
  aoAbrirAjustes: () => void;
  /** Ver `PilulaModoExecucao`: sobre o painel do projeto o portal
      precisa de um z acima de 230. */
  positionerClassName?: string;
}) {
  const provedores = useProvedores();
  const pendentes = provedores.filter((p) => p.conectado === false).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="pc-icon-btn pc-icon-btn--conectores"
        aria-label="Conectores"
        title="Conectores"
        data-pendente={pendentes > 0 ? "true" : undefined}
      >
        <IconeConectores />
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" sideOffset={10} positionerClassName={positionerClassName} className="w-[260px] p-2">
        {/* O rótulo do Base UI é uma peça de grupo: fora de um
            `Menu.Group` ele lança e derruba o popover inteiro. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 text-ms-sm font-normal text-ms-text-tertiary">
            Provedores de geração
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        {provedores.map((p) => (
          <div key={p.id} className="pcx-conector">
            <span
              className="pcx-conector-ponto"
              data-conectado={p.conectado === true ? "true" : p.conectado === false ? "false" : undefined}
              aria-hidden
            />
            <span className="pcx-conector-nome">{p.rotulo}</span>
            <span className="pcx-conector-estado">
              {p.conectado === null ? "verificando…" : p.conectado ? "conectado" : "sem chave"}
            </span>
          </div>
        ))}

        <DropdownMenuSeparator />

        <button
          type="button"
          onClick={aoAbrirAjustes}
          className="flex h-8 w-full items-center rounded-ms px-2 text-ms-base text-ms-text transition-colors hover:bg-ms-bg-hover"
        >
          Gerenciar conexões
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
