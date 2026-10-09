/* ============================================================
   A CREDENCIAL DO PITCHAI — service account → access_token

   O Pitch lê o Firestore do PitchAI direto, com a conta de serviço do
   projeto `gen-lang-client-0224756084`. Foi a decisão tomada: funciona
   com o PitchAI fora do ar e alcança `captured_products`, que é fechado
   a clientes e é onde estão as fotos boas.

   ── Por que não o firebase-admin ────────────────────────────────────
   O SDK traz uma árvore de dependências grande para fazer duas coisas:
   assinar um JWT e chamar uma REST. O Node já tem `crypto` para a
   primeira e `fetch` para a segunda, e o `package.json` daqui tem 16
   dependências no total — não vale dobrar o `node_modules` por isso.

   ── Onde a chave mora ───────────────────────────────────────────────
   `PITCHAI_SERVICE_ACCOUNT` aceita três formas, nesta ordem:

     1. caminho para o .json  (o recomendado — a chave não entra no repo)
     2. o JSON inteiro inline
     3. o JSON em base64      (para quem passa por variável de ambiente
                               de CI, onde quebra de linha atrapalha)

   Nada aqui é `NEXT_PUBLIC_`: esta chave assina como administrador do
   projeto e nunca pode chegar ao navegador. Este arquivo é servidor.
   ============================================================ */

import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

/** O escopo do Firestore. Só isto — a conta pode mais, nós não pedimos. */
const ESCOPO = "https://www.googleapis.com/auth/datastore";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export type ContaDeServico = {
  project_id: string;
  client_email: string;
  private_key: string;
};

export class SemCredencial extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "SemCredencial";
  }
}

function b64url(objeto: unknown): string {
  return Buffer.from(JSON.stringify(objeto)).toString("base64url");
}

/** Lê `PITCHAI_SERVICE_ACCOUNT` nas três formas aceitas. */
function lerConta(): ContaDeServico {
  const bruto = process.env.PITCHAI_SERVICE_ACCOUNT?.trim();
  if (!bruto) {
    throw new SemCredencial(
      "PITCHAI_SERVICE_ACCOUNT não está definida. Aponte-a para o .json da conta de serviço do PitchAI.",
    );
  }

  let texto: string;
  if (bruto.startsWith("{")) {
    texto = bruto;
  } else if (/^[A-Za-z0-9+/=]+$/.test(bruto) && bruto.length > 200) {
    texto = Buffer.from(bruto, "base64").toString("utf8");
  } else {
    try {
      texto = readFileSync(bruto, "utf8");
    } catch {
      throw new SemCredencial(`Não consegui ler o arquivo da conta de serviço em ${bruto}`);
    }
  }

  let conta: Partial<ContaDeServico>;
  try {
    conta = JSON.parse(texto) as Partial<ContaDeServico>;
  } catch {
    throw new SemCredencial("A conta de serviço do PitchAI não é um JSON válido.");
  }

  if (!conta.client_email || !conta.private_key || !conta.project_id) {
    throw new SemCredencial(
      "A conta de serviço do PitchAI está incompleta (faltam project_id, client_email ou private_key).",
    );
  }
  return conta as ContaDeServico;
}

/* O token vale uma hora. Guardar é o que evita uma ida ao Google a cada
   abertura do painel; a margem de 60s cobre o relógio da máquina estar
   um pouco à frente do do servidor. */
const MARGEM_MS = 60_000;
let cache: { token: string; expira: number } | null = null;

export async function tokenDoPitchai(): Promise<string> {
  if (cache && Date.now() < cache.expira - MARGEM_MS) return cache.token;

  const conta = lerConta();
  const agora = Math.floor(Date.now() / 1000);

  const cabeca = b64url({ alg: "RS256", typ: "JWT" });
  const corpo = b64url({
    iss: conta.client_email,
    scope: ESCOPO,
    aud: TOKEN_URL,
    iat: agora,
    exp: agora + 3600,
  });

  const assinador = createSign("RSA-SHA256");
  assinador.update(`${cabeca}.${corpo}`);
  const jwt = `${cabeca}.${corpo}.${assinador.sign(conta.private_key, "base64url")}`;

  const resposta = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const dados = (await resposta.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };

  if (!dados.access_token) {
    /* O `error_description` do Google é legível ("Invalid JWT Signature")
       e não vaza a chave — vale repassar, senão o diagnóstico vira
       adivinhação. */
    throw new SemCredencial(
      `O Google recusou a conta de serviço do PitchAI: ${dados.error_description ?? `HTTP ${resposta.status}`}`,
    );
  }

  cache = { token: dados.access_token, expira: Date.now() + (dados.expires_in ?? 3600) * 1000 };
  return cache.token;
}

/** O projeto de onde ler. Vem da própria credencial, não de outra variável. */
export function projetoDoPitchai(): string {
  return process.env.PITCHAI_PROJECT_ID?.trim() || lerConta().project_id;
}

/**
 * O banco não é o `(default)`: o PitchAI usa um Firestore nomeado, criado
 * pelo AI Studio. O id está no `firebase.json` de lá.
 */
export function bancoDoPitchai(): string {
  return (
    process.env.PITCHAI_FIRESTORE_DB?.trim() ||
    "ai-studio-pitchaihm-41b4a368-d7d8-4a8a-a783-84bbf8d5bfc4"
  );
}
