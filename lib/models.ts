export interface Model {
  id: string;
  label: string;
  desc: string;
}

export interface ModelGroup {
  label: string;
  models: Model[];
}

export const MODEL_GROUPS: ModelGroup[] = [
  {
    label: "Anthropic",
    models: [
      { id: "claude-opus-4-7",   label: "Opus 4.7",       desc: "Best"     },
      { id: "claude-sonnet-4-6", label: "Sonnet 4.6",     desc: "Powerful" },
      { id: "claude-haiku-4-5",  label: "Haiku 4.5",      desc: "Fast"     },
    ],
  },
  {
    label: "Google",
    models: [
      { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro", desc: "Pro"  },
      { id: "gemini-3-flash", label: "Gemini Flash",   desc: "Fast" },
    ],
  },
  {
    label: "OpenAI",
    models: [
      { id: "gpt-5-2", label: "GPT 5.2", desc: "Latest" },
    ],
  },
];

export const MODELS: Model[] = MODEL_GROUPS.flatMap(g => g.models);
// O Codex (sessão local do ChatGPT) e o Azure eram do app desktop; no Studio
// hospedado o Assistente conversa só pela kie.ai, cobrado em créditos.
export const CHAT_MODEL_GROUPS: ModelGroup[] = MODEL_GROUPS;
export const CHAT_MODELS: Model[] = CHAT_MODEL_GROUPS.flatMap(g => g.models);
export type ModelId = string;
