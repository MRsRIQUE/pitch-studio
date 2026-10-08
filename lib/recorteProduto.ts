/* ============================================================
   O RECORTE — a foto do TikTok virando material de cena

   A foto que vem da base é um anúncio: o produto no meio, mas com selo
   de desconto colado no canto, texto em chinês ou português mal
   composto, colagem de várias fotos numa só, fundo de estúdio barato.
   Jogar isso direto num modelo de vídeo faz o vídeo herdar o anúncio —
   o texto reaparece deformado, o selo vira uma mancha.

   Recortar é tirar tudo o que não é o produto.

   ── Como é feito ────────────────────────────────────────────────────
   Não há rota nova de geração. O recorte é uma edição de imagem como
   qualquer outra, e o app já tem o caminho inteiro pronto:
   `POST /api/generate` com um modelo que aceita entrada de imagem, e
   `GET /api/job-status` para acompanhar. Passar por ali significa
   herdar de graça o armazenamento em disco, o registro no acervo, a
   retomada do job depois de um reinício e a chave do usuário.

   ── Sobre transparência ─────────────────────────────────────────────
   O pedido era "fundo transparente ou branco". O que se entrega aqui é
   BRANCO PURO, e isso é uma escolha, não um esquecimento: modelos de
   imagem generativos não produzem canal alfa de verdade — eles pintam
   um xadrez cinza quando você pede "transparente", e aí o xadrez vira
   parte da imagem. Branco puro é recortável depois por qualquer
   ferramenta e nunca mente sobre o que é.
   ============================================================ */

/** O modelo do recorte. Precisa aceitar imagem de entrada; ver `IMAGE_MODELS`. */
export const MODELO_RECORTE = "nano-banana-pro";

/**
 * O prompt. É deliberadamente cheio de proibições: num pedido de edição
 * o que mais estraga o resultado não é o modelo deixar de fazer o que se
 * pediu, é ele fazer coisa a mais — reinventar o produto, mudar a cor,
 * "melhorar" o formato. As linhas de "keep" existem para segurar isso.
 */
export function promptDeRecorte(nomeDoProduto: string): string {
  return [
    `Isolate the product from this e-commerce photo: ${nomeDoProduto}.`,
    "",
    "Remove everything that is not the product itself: background, props, hands,",
    "models, price tags, discount badges, watermarks, logos, overlaid text in any",
    "language, arrows, stickers, borders and collage panels. If the source is a",
    "collage of several shots, keep only the single clearest view of the product.",
    "",
    "Place the isolated product centred on a pure white background (#FFFFFF), with",
    "even soft studio lighting and a subtle natural contact shadow beneath it.",
    "",
    "Keep the product exactly as it is: same shape, same proportions, same colours,",
    "same materials, same printed labels and packaging text that belong to the",
    "product itself. Do not redesign it, do not restyle it, do not add or remove",
    "parts, do not change the angle. This is a cut-out, not a new render.",
  ].join("\n");
}

export type ResultadoRecorte = { ok: true; url: string } | { ok: false; erro: string };

/** Quanto tempo esperar antes de desistir, e de quanto em quanto perguntar. */
const TETO_MS = 4 * 60_000;
const INTERVALO_MS = 2_000;

/**
 * Dispara o recorte e espera terminar. `sinal` permite desistir quando o
 * painel fecha — sem ele, uma navegação deixa um laço rodando à toa.
 */
export async function recortarProduto(
  produto: { nome: string; imagem: string },
  opcoes: { sinal?: AbortSignal; modelo?: string } = {},
): Promise<ResultadoRecorte> {
  const { sinal, modelo = MODELO_RECORTE } = opcoes;

  let taskId: string;
  try {
    const resposta = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        prompt: promptDeRecorte(produto.nome),
        /* A URL do CDN vai crua: `resolveImages` no servidor baixa para o
           disco antes de mandar ao provedor, então não precisa passar
           pelo nosso proxy — que serve à tela, não ao modelo. */
        imageUrls: [produto.imagem],
        /* Quadrado porque a foto de origem é 800×800 e o produto isolado
           não tem orientação própria. */
        aspectRatio: "1:1",
      }),
      signal: sinal,
    });

    const corpo = (await resposta.json().catch(() => ({}))) as { taskId?: string; error?: string };
    if (!resposta.ok || !corpo.taskId) {
      return { ok: false, erro: corpo.error ?? `A geração recusou (HTTP ${resposta.status})` };
    }
    taskId = corpo.taskId;
  } catch (erro) {
    if (sinal?.aborted) return { ok: false, erro: "cancelado" };
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
  }

  const limite = Date.now() + TETO_MS;
  while (Date.now() < limite) {
    if (sinal?.aborted) return { ok: false, erro: "cancelado" };
    await new Promise((r) => setTimeout(r, INTERVALO_MS));

    try {
      const resposta = await fetch(`/api/job-status?taskId=${encodeURIComponent(taskId)}`, { signal: sinal });
      const estado = (await resposta.json()) as {
        status?: string;
        imageUrl?: string;
        imageUrls?: string[];
        error?: string;
      };

      if (estado.status === "done") {
        const url = estado.imageUrl ?? estado.imageUrls?.[0];
        return url ? { ok: true, url } : { ok: false, erro: "A geração terminou sem imagem." };
      }
      if (estado.status === "error") {
        return { ok: false, erro: estado.error ?? "A geração falhou." };
      }
    } catch (erro) {
      if (sinal?.aborted) return { ok: false, erro: "cancelado" };
      /* Uma consulta que falha não derruba o recorte: o job segue no
         servidor e a próxima volta pega o resultado. */
      void erro;
    }
  }

  return { ok: false, erro: "O recorte passou de quatro minutos e eu parei de esperar." };
}
