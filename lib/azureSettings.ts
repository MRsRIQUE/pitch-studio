/* ============================================================
   PREFERÊNCIAS DO AZURE (localStorage)

   Estas funções viviam dentro de `components/SettingsModal.tsx`, e
   `app/chat/page.tsx` e `components/QuickAssist.tsx` importavam de lá —
   ou seja, duas telas dependiam do arquivo de um modal de 1.696 linhas
   só para ler quatro chaves de localStorage. Qualquer mexida no modal
   arriscava as duas.

   O módulo é a fonte agora; o modal reexporta para não quebrar quem
   ainda importa pelo caminho antigo.
   ============================================================ */

const AZURE_DEPLOYS_KEY      = "aiui-azure-endpoints";       // nomes de deployment por modelo
const AZURE_BASE_KEY         = "aiui-azure-base-url";        // URL base global do Foundry
const AZURE_TEXT_DEPLOY_KEY  = "aiui-azure-text-deployment"; // deployment do modelo de texto (caminho da URL)
const AZURE_TEXT_MODEL_KEY   = "aiui-azure-text-model";      // nome do modelo de texto (corpo da requisição)

/** Mapa de deployment por modelo (ex.: { "gpt-image-2": "gpt-image-2" }). */
export function loadAzureEndpoints(): Record<string, string> {
  try {
    const raw = localStorage.getItem(AZURE_DEPLOYS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveAzureEndpoints(map: Record<string, string>) {
  try {
    localStorage.setItem(AZURE_DEPLOYS_KEY, JSON.stringify(map));
  } catch { /* noop */ }
}

/** Nome do deployment do modelo, ou "" quando não definido. */
export function getAzureDeployment(modelId: string): string {
  return loadAzureEndpoints()[modelId] ?? "";
}

/** URL base do Azure Cognitive Services, compartilhada por todos os modelos. */
export function loadAzureBaseUrl(): string {
  try {
    return localStorage.getItem(AZURE_BASE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveAzureBaseUrl(url: string) {
  try {
    localStorage.setItem(AZURE_BASE_KEY, url);
  } catch { /* noop */ }
}

/** @deprecated renomeada — use getAzureDeployment(). Mantida por compatibilidade. */
export const getAzureEndpoint = getAzureDeployment;

/** Nome do deployment — vai no caminho da URL (padrão "auto-model"). */
export function loadAzureTextDeployment(): string {
  try {
    return localStorage.getItem(AZURE_TEXT_DEPLOY_KEY) ?? "auto-model";
  } catch {
    return "auto-model";
  }
}

export function saveAzureTextDeployment(name: string) {
  try {
    localStorage.setItem(AZURE_TEXT_DEPLOY_KEY, name);
  } catch { /* noop */ }
}

/** Nome do modelo — vai no corpo da requisição (padrão "model-router"). */
export function loadAzureTextModelName(): string {
  try {
    return localStorage.getItem(AZURE_TEXT_MODEL_KEY) ?? "model-router";
  } catch {
    return "model-router";
  }
}

export function saveAzureTextModelName(name: string) {
  try {
    localStorage.setItem(AZURE_TEXT_MODEL_KEY, name);
  } catch { /* noop */ }
}
