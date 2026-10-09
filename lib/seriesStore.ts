/* ============================================================
   SÉRIES — a conta que precisa chegar a 1.000 seguidores

   Uma série é um estilo do `serieKit` mais o SERIES LOCK gravado no
   momento da criação. O lock é o que faz a série existir: enquanto não
   há episódio, ele pode ser ajustado; a partir do primeiro episódio a
   tela o trata como travado, porque mudar a assinatura no meio é
   recomeçar o alcance do zero (a regra está no kit).

   Cada episódio guarda só os VALORES das variáveis, não o prompt
   montado: o prompt é derivado na hora com `montarEpisodio`, então uma
   correção no kit chega a todos os episódios sem migração. O que é
   registro histórico — quando foi publicado, retenção, seguidores que
   trouxe — fica no episódio, porque é isso que a leitura de resultado
   usa para dizer se é hora de trocar de formato.

   Persistência no padrão de `lib/personagensStore.ts`: zustand +
   `persist` com `partialize` explícito. Local, sem servidor.
   ============================================================ */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DIAS_MINIMOS_NA_SERIE,
  META_SEGUIDORES,
  POSTS_PARA_AVALIAR_TROCA,
  RETENCAO_MINIMA,
  SERIE_KIT_VERSION,
  type EstiloId,
  type SerieLock,
} from "./serieKit";

export interface MetricasEpisodio {
  /** Retenção média em %, como o TikTok mostra. */
  retencao?: number;
  /** Seguidores que o post trouxe. O número que importa. */
  seguidores?: number;
  /** Views. Guardado, mas nunca usado para decidir nada. */
  views?: number;
}

export interface Episodio {
  id: string;
  numero: number;
  valores: Record<string, string>;
  criadoEm: string;
  /** ISO. Ausente enquanto não foi postado. */
  publicadoEm?: string;
  metricas: MetricasEpisodio;
  /** Um booleano por item de `CHECKLIST_PUBLICACAO`, na mesma ordem. */
  checklist: boolean[];
}

export interface Serie {
  id: string;
  nome: string;
  estiloId: EstiloId;
  lock: SerieLock;
  kitVersion: string;
  /** "HH:MM". O horário fixo importa mais que o ideal. */
  horarioPost: string;
  episodios: Episodio[];
  criadoEm: string;
  atualizadoEm: string;
  ativo: boolean;
}

interface EstadoSeries {
  series: Serie[];
  criar: (dados: { nome: string; estiloId: EstiloId; lock: SerieLock; horarioPost?: string }) => string;
  renomear: (id: string, nome: string) => void;
  definirLock: (id: string, lock: SerieLock) => void;
  definirHorario: (id: string, horarioPost: string) => void;
  alternarAtivo: (id: string) => void;
  remover: (id: string) => void;
  adicionarEpisodio: (id: string, valores: Record<string, string>) => string;
  atualizarValores: (id: string, epId: string, valores: Record<string, string>) => void;
  removerEpisodio: (id: string, epId: string) => void;
  marcarPublicado: (id: string, epId: string, publicado: boolean) => void;
  definirMetricas: (id: string, epId: string, metricas: MetricasEpisodio) => void;
  alternarChecklist: (id: string, epId: string, indice: number) => void;
}

const agora = () => new Date().toISOString();

function novoId(prefixo: string): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

function naSerie(series: Serie[], id: string, fn: (s: Serie) => Serie): Serie[] {
  return series.map((s) => (s.id === id ? { ...fn(s), atualizadoEm: agora() } : s));
}

function noEpisodio(s: Serie, epId: string, fn: (e: Episodio) => Episodio): Serie {
  return { ...s, episodios: s.episodios.map((e) => (e.id === epId ? fn(e) : e)) };
}

export const useSeriesStore = create<EstadoSeries>()(
  persist(
    (set) => ({
      series: [],

      criar: ({ nome, estiloId, lock, horarioPost }) => {
        const id = novoId("serie");
        const instante = agora();
        set((e) => ({
          series: [
            { id, nome: nome.trim() || "Série sem nome", estiloId, lock: { ...lock }, kitVersion: SERIE_KIT_VERSION, horarioPost: horarioPost ?? "", episodios: [], criadoEm: instante, atualizadoEm: instante, ativo: true },
            ...e.series,
          ],
        }));
        return id;
      },

      renomear: (id, nome) => set((e) => ({ series: naSerie(e.series, id, (s) => ({ ...s, nome: nome.trim() || s.nome })) })),
      definirLock: (id, lock) => set((e) => ({ series: naSerie(e.series, id, (s) => ({ ...s, lock: { ...lock } })) })),
      definirHorario: (id, horarioPost) => set((e) => ({ series: naSerie(e.series, id, (s) => ({ ...s, horarioPost })) })),
      alternarAtivo: (id) => set((e) => ({ series: naSerie(e.series, id, (s) => ({ ...s, ativo: !s.ativo })) })),
      remover: (id) => set((e) => ({ series: e.series.filter((s) => s.id !== id) })),

      adicionarEpisodio: (id, valores) => {
        const epId = novoId("ep");
        set((e) => ({
          series: naSerie(e.series, id, (s) => ({
            ...s,
            episodios: [
              ...s.episodios,
              { id: epId, numero: (s.episodios[s.episodios.length - 1]?.numero ?? 0) + 1, valores: { ...valores }, criadoEm: agora(), metricas: {}, checklist: [] },
            ],
          })),
        }));
        return epId;
      },

      atualizarValores: (id, epId, valores) => set((e) => ({
        series: naSerie(e.series, id, (s) => noEpisodio(s, epId, (ep) => ({ ...ep, valores: { ...valores } }))),
      })),

      removerEpisodio: (id, epId) => set((e) => ({
        series: naSerie(e.series, id, (s) => ({ ...s, episodios: s.episodios.filter((ep) => ep.id !== epId) })),
      })),

      marcarPublicado: (id, epId, publicado) => set((e) => ({
        series: naSerie(e.series, id, (s) => noEpisodio(s, epId, (ep) => ({ ...ep, publicadoEm: publicado ? ep.publicadoEm ?? agora() : undefined }))),
      })),

      definirMetricas: (id, epId, metricas) => set((e) => ({
        series: naSerie(e.series, id, (s) => noEpisodio(s, epId, (ep) => ({ ...ep, metricas: { ...ep.metricas, ...metricas } }))),
      })),

      alternarChecklist: (id, epId, indice) => set((e) => ({
        series: naSerie(e.series, id, (s) => noEpisodio(s, epId, (ep) => {
          const lista = [...ep.checklist];
          lista[indice] = !lista[indice];
          return { ...ep, checklist: lista };
        })),
      })),
    }),
    {
      name: "pitch-series",
      partialize: (e) => ({ series: e.series }),
    },
  ),
);

/* ── Leitura de resultado ─────────────────────────────────────
   As regras do kit, em número: retenção média e seguidores-por-post,
   nunca views. E o alarme de troca: 10 posts seguidos abaixo de 40%. */

export interface LeituraDaSerie {
  publicados: number;
  /** Dias desde o primeiro post. `0` sem post. */
  diasDeSerie: number;
  diasMinimos: number;
  /** Média das retenções informadas nos publicados. `null` sem dado. */
  retencaoMedia: number | null;
  seguidoresTotal: number;
  /** Seguidores ÷ posts que informaram seguidores. `null` sem dado. */
  seguidoresPorPost: number | null;
  meta: number;
  /** `true` quando os últimos 10 publicados, todos com retenção informada, ficaram abaixo do mínimo. */
  alertaTrocar: boolean;
  /** Publicado hoje? Para a cadência diária. */
  postouHoje: boolean;
}

export function lerSerie(serie: Serie, hoje = new Date()): LeituraDaSerie {
  const publicados = serie.episodios.filter((e) => e.publicadoEm).sort((a, b) => (a.publicadoEm! < b.publicadoEm! ? -1 : 1));
  const primeiro = publicados[0]?.publicadoEm;
  const diasDeSerie = primeiro ? Math.max(1, Math.floor((hoje.getTime() - new Date(primeiro).getTime()) / 86_400_000) + 1) : 0;

  const comRetencao = publicados.filter((e) => typeof e.metricas.retencao === "number");
  const retencaoMedia = comRetencao.length ? comRetencao.reduce((acc, e) => acc + (e.metricas.retencao ?? 0), 0) / comRetencao.length : null;

  const comSeguidores = publicados.filter((e) => typeof e.metricas.seguidores === "number");
  const seguidoresTotal = comSeguidores.reduce((acc, e) => acc + (e.metricas.seguidores ?? 0), 0);
  const seguidoresPorPost = comSeguidores.length ? seguidoresTotal / comSeguidores.length : null;

  const ultimos = comRetencao.slice(-POSTS_PARA_AVALIAR_TROCA);
  const alertaTrocar = ultimos.length >= POSTS_PARA_AVALIAR_TROCA && ultimos.every((e) => (e.metricas.retencao ?? 0) < RETENCAO_MINIMA);

  const chaveHoje = hoje.toISOString().slice(0, 10);
  const postouHoje = publicados.some((e) => e.publicadoEm!.slice(0, 10) === chaveHoje);

  return { publicados: publicados.length, diasDeSerie, diasMinimos: DIAS_MINIMOS_NA_SERIE, retencaoMedia, seguidoresTotal, seguidoresPorPost, meta: META_SEGUIDORES, alertaTrocar, postouHoje };
}

/** Seguidores somados de todas as séries — o progresso rumo à meta da conta. */
export function seguidoresDaConta(series: Serie[]): number {
  return series.reduce((acc, s) => acc + lerSerie(s).seguidoresTotal, 0);
}
