"use client";

/* ============================================================
   OS DADOS DO PERFIL

   Regra desta frente: cada campo da tela mostra um número que dá
   para conferir em outra tela do app. Onde a referência mostra um
   dado que não medimos — tokens gastos, duração de tarefa, plano,
   arroba — nada foi inventado; o que entrou no lugar está anotado
   em `.migracao/relatos/prisma-leva8.md`.

   Tudo sai de rota que já existe:

     acervo    →  GET /api/gallery?type=image|video   (gerações + envios)
     projetos  →  GET /api/workflows
     pastas    →  GET /api/folders
     créditos  →  GET /api/credit          (saldo real da Kie.ai)

   O acervo é paginado de 20 em 20 e a tela precisa de TODAS as datas
   para o mapa de atividade, então as páginas são varridas até o
   `hasMore` da própria rota virar falso. Sem rota nova: `app/api`
   não é desta frente.
   ============================================================ */

import { useEffect, useMemo, useState } from "react";

/** Só os campos do `GalleryItem` que esta tela lê. */
export interface Peca {
  id: string;
  url: string;
  mediaType: "image" | "video";
  source: "generation" | "upload";
  model?: string;
  created_at: string;
}

/** Teto de varredura: 50 páginas × 20 = 1000 peças por tipo. Acima
    disso o mapa continua desenhando, mas com as mil mais recentes —
    e o relatório diz isso, em vez de a tela mentir em silêncio. */
const MAX_PAGINAS = 50;

/* Uma varredura só, sem o filtro `source`: a rota já devolve gerações e
   envios juntos e deduplicados por URL, e cada item diz de qual origem é.
   Duas varreduras (uma por origem) dobrariam as requisições para obter
   exatamente a mesma lista. */
async function varrer(tipo: "image" | "video"): Promise<Peca[]> {
  const todas: Peca[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const resposta = await fetch(`/api/gallery?type=${tipo}&page=${pagina}`);
    if (!resposta.ok) break;
    const dados = (await resposta.json()) as { items?: Peca[]; hasMore?: boolean };
    todas.push(...(dados.items ?? []));
    if (!dados.hasMore) break;
  }
  return todas;
}

/** Chave de dia no fuso do usuário — é o dia que ele viu na tela. */
export function chaveDoDia(data: Date): string {
  const m = `${data.getMonth() + 1}`.padStart(2, "0");
  const d = `${data.getDate()}`.padStart(2, "0");
  return `${data.getFullYear()}-${m}-${d}`;
}

export function diaZero(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

const DIA_MS = 86_400_000;

export interface DadosPerfil {
  carregando: boolean;
  /** Tudo o que está no Acervo: gerações e envios. */
  pecas: Peca[];
  /** Só as gerações — é o que os rótulos "Gerações" contam. */
  geracoes: Peca[];
  /** Gerações por dia, no fuso do usuário. */
  porDia: Map<string, number>;
  totalGeracoes: number;
  /** `null` = a rota não respondeu; a tela mostra "—", nunca zero. */
  projetos: number | null;
  pastas: number | null;
  creditos: number | null;
  /** Maior sequência de dias seguidos com pelo menos uma geração. */
  maiorSequencia: number;
  /** Data da geração mais antiga — vira o "Membro desde". */
  primeira: Date | null;
  /** Capa: a imagem mais recente do acervo. */
  capa: string | null;
}

export function useDadosPerfil(): DadosPerfil {
  const [pecas, setPecas] = useState<Peca[] | null>(null);
  const [capa, setCapa] = useState<string | null>(null);
  const [projetos, setProjetos] = useState<number | null>(null);
  const [pastas, setPastas] = useState<number | null>(null);
  const [creditos, setCreditos] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;

    (async () => {
      const [imagens, videos] = await Promise.all([varrer("image"), varrer("video")]);
      if (!vivo) return;
      const todas = [...imagens, ...videos].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      setPecas(todas);
      /* A capa é a imagem mais recente do acervo. Vídeo não entra: a
         faixa é uma `<img>` de 165px, e um vídeo em laço aí seria
         outro desenho, não o da referência. */
      const ultimaImagem = imagens
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      setCapa(ultimaImagem?.url ?? null);
    })().catch(() => { if (vivo) setPecas([]) });

    fetch("/api/workflows")
      .then(r => (r.ok ? r.json() : null))
      .then((d: { spaces?: unknown[] } | null) => { if (vivo && d?.spaces) setProjetos(d.spaces.length) })
      .catch(() => { /* fica em null: a caixa mostra "—" */ });

    fetch("/api/folders")
      .then(r => (r.ok ? r.json() : null))
      .then((d: { folders?: unknown[] } | null) => { if (vivo && d?.folders) setPastas(d.folders.length) })
      .catch(() => { /* idem */ });

    /* Sem chave da Kie.ai a rota devolve 401 — e aí o saldo é
       desconhecido, não zero. */
    fetch("/api/credit")
      .then(r => (r.ok ? r.json() : null))
      .then((d: { data?: number } | null) => {
        if (vivo && typeof d?.data === "number") setCreditos(d.data);
      })
      .catch(() => { /* idem */ });

    return () => { vivo = false };
  }, []);

  return useMemo(() => {
    const lista = pecas ?? [];
    const geracoes = lista.filter(p => p.source === "generation");

    const porDia = new Map<string, number>();
    for (const peca of geracoes) {
      const chave = chaveDoDia(new Date(peca.created_at));
      porDia.set(chave, (porDia.get(chave) ?? 0) + 1);
    }

    /* A sequência é contada sobre os dias COM geração, ordenados: se
       o dia seguinte é o dia + 1, a corrente continua. */
    const dias = [...porDia.keys()].sort();
    let maiorSequencia = 0;
    let corrente = 0;
    let anterior: number | null = null;
    for (const dia of dias) {
      const [a, m, d] = dia.split("-").map(Number);
      const t = new Date(a, m - 1, d).getTime();
      corrente = anterior !== null && t - anterior === DIA_MS ? corrente + 1 : 1;
      anterior = t;
      if (corrente > maiorSequencia) maiorSequencia = corrente;
    }

    return {
      carregando: pecas === null,
      pecas: lista,
      geracoes,
      porDia,
      totalGeracoes: geracoes.length,
      projetos,
      pastas,
      creditos,
      maiorSequencia,
      primeira: lista.length ? new Date(lista[0].created_at) : null,
      capa,
    };
  }, [pecas, capa, projetos, pastas, creditos]);
}

/* ============================================================
   FORMATADORES
   ============================================================ */

const inteiro = new Intl.NumberFormat("pt-BR");
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mesAno = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const diaCurto = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" });
const mesCurto = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const mesLongo = new Intl.DateTimeFormat("pt-BR", { month: "long" });

/** Contagem desconhecida vira travessão — nunca zero. */
export function num(valor: number | null): string {
  return valor === null ? "—" : inteiro.format(valor);
}

export function saldo(valor: number | null): string {
  return valor === null ? "—" : decimal.format(valor);
}

export function desde(data: Date | null): string {
  return data ? `Membro desde ${mesAno.format(data)}` : "Sem peças ainda";
}

/** "07 set" — o pt-BR devolve "07 de set." e o eixo não tem largura
    para a preposição nem para o ponto. */
export function rotuloDiaMes(data: Date): string {
  return `${diaCurto.format(data)} ${mesCurto.format(data).replace(".", "")}`;
}

export function rotuloMes(data: Date): string {
  const nome = mesLongo.format(data);
  const capitalizado = nome.charAt(0).toUpperCase() + nome.slice(1);
  /* O ano só aparece quando não é o corrente: é o que mantém o
     rótulo dentro dos 128px do passador na maior parte do tempo. */
  return data.getFullYear() === new Date().getFullYear()
    ? capitalizado
    : `${capitalizado} ${data.getFullYear()}`;
}

export function plural(n: number, singular: string, plural_: string): string {
  return `${inteiro.format(n)} ${n === 1 ? singular : plural_}`;
}
