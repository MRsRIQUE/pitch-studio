"use client";

/**
 * Tema claro/escuro do Studio. A escolha mora no cookie `ss_tema` para o
 * layout (servidor) já desenhar o <html> com a classe certa, sem piscar.
 * Sem cookie, o script de `TEMA_SCRIPT_INICIAL` segue o tema do sistema.
 */
import { useCallback, useSyncExternalStore } from "react";
import { TEMA_COOKIE } from "./temaCookie";

export type Tema = "claro" | "escuro";

/** Cor da barra do navegador em cada tema (fundo da página). */
const COR_DA_BARRA: Record<Tema, string> = { claro: "#f9f9f9", escuro: "#07122a" };

const ouvintes = new Set<() => void>();

function temaAtual(): Tema {
  return document.documentElement.classList.contains("dark") ? "escuro" : "claro";
}

export function aplicarTema(tema: Tema) {
  document.documentElement.classList.toggle("dark", tema === "escuro");
  document.cookie = `${TEMA_COOKIE}=${tema}; path=/; max-age=31536000; samesite=lax`;
  // O layout publica uma meta por esquema do sistema; a escolha manual vale para as duas.
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", COR_DA_BARRA[tema]));
  ouvintes.forEach((avisar) => avisar());
}

function assinar(avisar: () => void) {
  ouvintes.add(avisar);
  return () => ouvintes.delete(avisar);
}

export function useTema(): { tema: Tema; alternar: () => void } {
  const tema = useSyncExternalStore(assinar, temaAtual, () => "claro" as Tema);
  const alternar = useCallback(() => aplicarTema(temaAtual() === "escuro" ? "claro" : "escuro"), []);
  return { tema, alternar };
}
