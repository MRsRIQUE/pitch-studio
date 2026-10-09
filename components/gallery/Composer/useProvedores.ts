"use client";

/* ============================================================
   O ESTADO REAL DOS TRÊS PROVEDORES

   Onde a referência lista apps externos (Notion, Figma, Bitable,
   GitHub), nós listamos os provedores que realmente movem o app —
   Kie.ai, Azure Foundry e Codex CLI —, cada um com o estado da chave
   que ele exige. Nada aqui é decorativo: o que a faixa e o popover
   mostram sai da mesma leitura que o modal de ajustes usa.

   Kie e Azure vivem no store (o modal já os mantém em dia). O Codex
   não tem chave por usuário: é um `codex login` na máquina, e só a
   rota sabe dizer se ele está de pé.
   ============================================================ */

import * as React from "react";
import { useWorkflowStore } from "@/lib/store";
import { PROVIDERS, type ProviderId } from "@/lib/providers";

export type EstadoProvedor = {
  id: ProviderId;
  rotulo: string;
  /** `null` enquanto a leitura não voltou. */
  conectado: boolean | null;
  /** Por que ele não está conectado — vai para o `title` do ícone. */
  motivo: string;
};

const MOTIVO: Record<ProviderId, string> = {
  kie: "Falta a chave da Kie.ai nos ajustes",
  azure: "Falta a chave do Azure Foundry nos ajustes",
  codex: "O `codex login` não está feito nesta máquina",
};

export function useProvedores(): EstadoProvedor[] {
  const kieKeySet = useWorkflowStore((s) => s.kieKeySet);
  const azureKeySet = useWorkflowStore((s) => s.azureKeySet);
  // O Codex era do app desktop (`codex login` na máquina); no Studio
  // hospedado ele não existe e a lista de provedores só tem a kie.ai.
  const codexPronto = false;

  return React.useMemo(() => {
    const estado: Record<ProviderId, boolean | null> = {
      kie: kieKeySet,
      azure: azureKeySet,
      codex: codexPronto,
    };
    return PROVIDERS.map((p) => ({
      id: p.id,
      rotulo: p.label,
      conectado: estado[p.id],
      motivo: MOTIVO[p.id],
    }));
  }, [kieKeySet, azureKeySet, codexPronto]);
}

/** A inicial que o ícone mostra — a variante que o próprio Miora usa
    quando a arte do app não carrega (`--connect-icon--initial`). */
export function inicialProvedor(rotulo: string): string {
  return rotulo.charAt(0).toUpperCase();
}
