/* ============================================================
   ESTILOS — a nossa Skills

   Réplica do bloco 06 do Miora (`miora/sections/06-skills`). Lá uma skill é um
   pacote versionado, instalado, ligado no agente e servido por um marketplace.
   Aqui o objeto é um fragmento de prompt guardado no navegador — mas os quatro
   estados que a referência desenha existem de verdade e são mantidos:

   - `enabled`   → o toggle do cartão instalado. Um estilo desligado continua
                   guardado, mas não é oferecido ao composer nem à linha de
                   especialistas (bloco 04, que lê este store).
   - `version`   → o `currentVersion` cinza ao lado do nome. Nasce em 1.0.0 e
                   sobe um patch a cada edição salva. É contagem local real, não
                   número de marketplace.
   - `isModified`→ o selo `Modified` da referência. Verdadeiro assim que o
                   usuário edita o estilo depois de criado/adicionado.
   - `appliedCounts` → o contador que na referência é `downloads`. Aqui é quantas
                   vezes o fragmento foi aplicado no composer. Conta por estilo
                   E por sugestão de origem, para o número sobreviver a apagar e
                   readicionar o mesmo ponto de partida — é o que faz o cartão
                   de Sugeridos mostrar um número que aconteceu, não um zero
                   decorativo.

   Persistência no padrão do `lib/folderStore.ts`: zustand + `persist`, com
   `partialize` explícito. Sem chamada de API — o app é local.
   ============================================================ */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Estilo {
  id: string;
  name: string;
  /** O texto que é anexado ao prompt. É o conteúdo inteiro do estilo. */
  fragment: string;
  createdAt: string;
  updatedAt: string;
  /** `sugestao` marca os que nasceram de um ponto de partida nosso, para a
      grade de sugeridos saber quais já foram adicionados. É também o que separa
      os dois chips de filtro do cabeçalho, como o `skillType` da referência. */
  origin: "propria" | "sugestao";
  suggestionId?: string;
  /** Versão local. Sobe um patch a cada edição salva. */
  version: string;
  /** Editado depois de criado/adicionado — o selo do cartão. */
  isModified: boolean;
  /** Ligado: participa das sugestões do composer. */
  enabled: boolean;
}

/** Chave do contador de uma sugestão dentro de `appliedCounts`. */
export function suggestionCountKey(suggestionId: string): string {
  return `sug:${suggestionId}`;
}

interface EstilosState {
  estilos: Estilo[];
  /** Último estilo aplicado no composer — o cabeçalho o marca como aplicado. */
  lastAppliedId: string | null;
  /** Aplicações por estilo (`id`) e por sugestão de origem (`sug:<id>`). */
  appliedCounts: Record<string, number>;

  createEstilo: (name: string, fragment: string) => Estilo;
  updateEstilo: (id: string, updates: Partial<Pick<Estilo, "name" | "fragment">>) => void;
  removeEstilo: (id: string) => void;
  duplicateEstilo: (id: string) => Estilo | null;
  addFromSuggestion: (suggestionId: string, name: string, fragment: string, version: string) => Estilo;
  setEnabled: (id: string, enabled: boolean) => void;
  markApplied: (id: string) => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  /* `crypto.randomUUID` não existe em contexto não-seguro; o fallback mantém a
     criação de estilo funcionando em qualquer origem. */
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `estilo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 1.0.0 → 1.0.1. Um valor fora do formato volta para 1.0.1 em vez de virar NaN. */
function bumpPatch(version: string): string {
  const parts = version.split(".").map(part => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) return "1.0.1";
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

export const useEstilosStore = create<EstilosState>()(
  persist(
    (set, get) => ({
      estilos: [],
      lastAppliedId: null,
      appliedCounts: {},

      createEstilo: (name, fragment) => {
        const estilo: Estilo = {
          id: newId(),
          name: name.trim(),
          fragment: fragment.trim(),
          createdAt: nowIso(),
          updatedAt: nowIso(),
          origin: "propria",
          version: "1.0.0",
          isModified: false,
          enabled: true,
        };
        set(state => ({ estilos: [estilo, ...state.estilos] }));
        return estilo;
      },

      updateEstilo: (id, updates) =>
        set(state => ({
          estilos: state.estilos.map(estilo =>
            estilo.id === id
              ? {
                  ...estilo,
                  ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
                  ...(updates.fragment !== undefined ? { fragment: updates.fragment.trim() } : {}),
                  updatedAt: nowIso(),
                  version: bumpPatch(estilo.version),
                  isModified: true,
                }
              : estilo,
          ),
        })),

      removeEstilo: id =>
        set(state => ({
          estilos: state.estilos.filter(estilo => estilo.id !== id),
          lastAppliedId: state.lastAppliedId === id ? null : state.lastAppliedId,
          /* O contador do estilo morre com ele; o da sugestão fica, porque é
             dela que o cartão de Sugeridos volta a falar. */
          appliedCounts: Object.fromEntries(
            Object.entries(state.appliedCounts).filter(([key]) => key !== id),
          ),
        })),

      duplicateEstilo: id => {
        const source = get().estilos.find(estilo => estilo.id === id);
        if (!source) return null;
        const copy: Estilo = {
          ...source,
          id: newId(),
          name: `${source.name} (cópia)`,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          /* A cópia é do usuário mesmo que o original tenha vindo de um ponto de
             partida — senão a grade de sugeridos marcaria a cópia como já
             adicionada e o ponto de partida sumiria de lá. */
          origin: "propria",
          suggestionId: undefined,
          version: "1.0.0",
          isModified: false,
          enabled: true,
        };
        set(state => ({ estilos: [copy, ...state.estilos] }));
        return copy;
      },

      addFromSuggestion: (suggestionId, name, fragment, version) => {
        const estilo: Estilo = {
          id: newId(),
          name,
          fragment,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          origin: "sugestao",
          suggestionId,
          /* Herda a versão publicada do ponto de partida, como a skill instalada
             herda o `currentVersion` do que veio do marketplace. */
          version,
          isModified: false,
          enabled: true,
        };
        set(state => ({ estilos: [estilo, ...state.estilos] }));
        return estilo;
      },

      setEnabled: (id, enabled) =>
        set(state => ({
          estilos: state.estilos.map(estilo => (estilo.id === id ? { ...estilo, enabled } : estilo)),
        })),

      markApplied: id =>
        set(state => {
          const estilo = state.estilos.find(item => item.id === id);
          const counts = { ...state.appliedCounts };
          counts[id] = (counts[id] ?? 0) + 1;
          if (estilo?.suggestionId) {
            const key = suggestionCountKey(estilo.suggestionId);
            counts[key] = (counts[key] ?? 0) + 1;
          }
          return { lastAppliedId: id, appliedCounts: counts };
        }),
    }),
    {
      name: "pitch-estilos-v1",
      version: 2,
      /* Estilos salvos sob a v1 do store não têm versão, selo nem toggle.
         Sem este preenchimento eles apareceriam com `undefined` no lugar da
         versão e desligados. */
      migrate: persisted => {
        const state = (persisted ?? {}) as Partial<EstilosState>;
        return {
          ...state,
          appliedCounts: state.appliedCounts ?? {},
          estilos: (state.estilos ?? []).map(estilo => ({
            ...estilo,
            version: estilo.version ?? "1.0.0",
            isModified: estilo.isModified ?? false,
            enabled: estilo.enabled ?? true,
          })),
        } as EstilosState;
      },
      partialize: state => ({
        estilos: state.estilos,
        lastAppliedId: state.lastAppliedId,
        appliedCounts: state.appliedCounts,
      }),
    },
  ),
);
