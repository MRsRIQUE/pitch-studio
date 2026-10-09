import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Migração das chaves da marca antiga, no mesmo padrão de lib/store.ts:
// renomear sem migrar orfanaria as conversas salvas antes do rebrand.
if (typeof window !== "undefined") {
  const pairs: [string, string][] = [
    ["heliosgen-chats", "pitch-studio-chats"],
    ["heliosgen-chats-guest", "pitch-studio-chats-guest"],
  ];
  for (const [legacyKey, currentKey] of pairs) {
    const old = localStorage.getItem(legacyKey);
    if (old) {
      localStorage.setItem(currentKey, old);
      localStorage.removeItem(legacyKey);
    }
  }
}

export interface StoredMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: import("./assistantTurno").ChamadaCrua[];
  toolCallId?: string;
  artifact?: { tipo: "workflow" | "personagem"; id: string; nome: string };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: StoredMessage[];
  model: string;
  createdAt: number;
  updatedAt: number;
}

interface ChatSessionState {
  sessions: ChatSession[];
  preferredModel: string;
  setPreferredModel: (model: string) => void;
  createSession: (model: string, title: string) => string;
  upsertSession: (id: string, messages: StoredMessage[], model: string) => void;
  deleteSession: (id: string) => void;
  clearSessions: () => void;
}

export const useChatSessionStore = create<ChatSessionState>()(
  persist(
    (set) => ({
      sessions: [],
      preferredModel: "claude-sonnet-4-6",

      setPreferredModel: (model) => set({ preferredModel: model }),

      createSession: (model, title) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        set(s => ({
          sessions: [
            { id, title, messages: [], model, createdAt: now, updatedAt: now },
            ...s.sessions,
          ],
        }));
        return id;
      },

      upsertSession: (id, messages, model) => {
        const updatedAt = Date.now();
        set(s => ({
          sessions: s.sessions.map(sess =>
            sess.id === id ? { ...sess, messages, model, updatedAt } : sess
          ),
        }));
      },

      deleteSession: (id) => {
        set(s => ({ sessions: s.sessions.filter(sess => sess.id !== id) }));
      },

      clearSessions: () => set({ sessions: [] }),
    }),
    {
      name: "pitch-studio-chats-guest",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
