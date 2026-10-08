"use client";

/* ============================================================
   O SALDO DE CRÉDITOS DA KIE.AI — um hook para quem quiser mostrar

   A `AppSidebar` já buscava o saldo em `/api/credit`, com o mesmo
   trio: uma vez ao montar, a cada 60s, e sempre que alguém dispara
   `credits-refresh` (o fim de uma geração, o botão de atualizar do
   cabeçalho do projeto). O Workflow precisa do mesmo número no cromo,
   então a lógica saiu do componente e veio para cá.

   Um quarto gatilho entrou junto: voltar para a aba. Quem gerou algo,
   foi ver o resultado em outra janela e voltou quer o saldo atual, não
   o de até um minuto atrás.
   ============================================================ */

import * as React from "react";

export const EVENTO_CREDITOS = "credits-refresh";

/** Onde a Kie vende créditos — o mesmo link de referência da sidebar. */
export const URL_COMPRAR_CREDITOS = "https://kie.ai?ref=25abb3f2236cbff9780ab9c2f84479ec";

export type EstadoCreditos = {
  /** `null` enquanto não se sabe, ou quando não há chave configurada. */
  saldo: number | null;
  carregando: boolean;
  /** A rota devolveu 401: não há chave da Kie nos ajustes. */
  semChave: boolean;
  /** Falha de rede ou da Kie — o último saldo conhecido continua valendo. */
  erro: boolean;
  atualizar: () => void;
};

/** A Kie já devolveu o saldo em dois formatos; os dois são aceitos. */
function lerSaldo(corpo: unknown): number | null {
  const d = (corpo as { data?: unknown; balance?: unknown })?.data;
  if (typeof d === "number") return d;
  const aninhado = (d as { balance?: unknown } | undefined)?.balance;
  if (typeof aninhado === "number") return aninhado;
  const raiz = (corpo as { balance?: unknown })?.balance;
  return typeof raiz === "number" ? raiz : null;
}

export function useCreditos(): EstadoCreditos {
  const [saldo, setSaldo] = React.useState<number | null>(null);
  const [carregando, setCarregando] = React.useState(true);
  const [semChave, setSemChave] = React.useState(false);
  const [erro, setErro] = React.useState(false);

  const buscar = React.useCallback(async () => {
    try {
      const res = await fetch("/api/credit", { cache: "no-store" });
      if (res.status === 401) {
        setSemChave(true);
        setSaldo(null);
        setErro(false);
        return;
      }
      if (!res.ok) {
        setErro(true);
        return;
      }
      setSemChave(false);
      setErro(false);
      setSaldo(lerSaldo(await res.json()));
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, []);

  React.useEffect(() => {
    /* A primeira busca sai do corpo do efeito (que não deve escrever
       estado direto) para a fila de tarefas — mesmo resultado, sem o
       render em cascata que a regra do React aponta. */
    const inicial = setTimeout(() => void buscar(), 0);
    const intervalo = setInterval(() => void buscar(), 60_000);
    const aoVoltar = () => { if (document.visibilityState === "visible") void buscar(); };
    window.addEventListener(EVENTO_CREDITOS, buscar);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearTimeout(inicial);
      clearInterval(intervalo);
      window.removeEventListener(EVENTO_CREDITOS, buscar);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [buscar]);

  return { saldo, carregando, semChave, erro, atualizar: () => void buscar() };
}

/** Formata como a sidebar: `609,83`, sem casas quando é inteiro. */
export function formatarCreditos(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
