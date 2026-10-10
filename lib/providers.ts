// ─────────────────────────────────────────────────────────────────────────────
// PROVIDERS — seleção de backend por modelo, usada pelo modal de ajustes, pelo
// GenerateNode do workflow e pelo composer da galeria.
//
// No Studio hospedado só existe a kie.ai: Azure Foundry e Codex CLI eram do
// app desktop (chave e login na máquina do usuário). Os ids continuam no tipo
// para as telas antigas compilarem, mas nenhum modelo sai da kie.ai.
// ─────────────────────────────────────────────────────────────────────────────

export type ProviderId = "kie" | "azure" | "codex";

export const PROVIDERS: ReadonlyArray<{ id: ProviderId; label: string }> = [
  { id: "kie", label: "Kie.ai" },
];

const STORAGE_KEY = "aiui-model-providers";

export function loadModelProviders(): Record<string, ProviderId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveModelProviders(map: Record<string, ProviderId>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent("aiui-providers-changed"));
  } catch { /* noop */ }
}

/** Sempre a kie.ai — uma escolha antiga de Azure/Codex no navegador é ignorada. */
export function getModelProvider(_modelId: string): ProviderId {
  return "kie";
}

/** Persists the backend for a single model, leaving the others untouched. */
export function setModelProvider(modelId: string, provider: ProviderId) {
  const map = loadModelProviders();
  saveModelProviders({ ...map, [modelId]: provider });
}

/** Nenhum modelo tem mais de um backend no Studio hospedado. */
export function modelHasProviderChoice(_modelId: string): boolean {
  return false;
}
