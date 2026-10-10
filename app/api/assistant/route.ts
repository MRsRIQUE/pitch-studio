export const dynamic = "force-dynamic";

/* ── As ferramentas do assistente (leva 7) ────────────────────
   Esta rota era um cano: recebia mensagens e devolvia o fluxo do
   provedor sem tocar em nada. Continua sendo, com uma diferença — ela
   agora DECLARA ferramentas, para o assistente poder montar o fluxo do
   usuário no grafo do projeto aberto.

   Ela não executa nenhuma delas. Quem executa é o cliente, em
   `lib/projetoFluxo.ts`, porque é lá que o `space` vive. A rota só
   traduz: o cliente fala UM formato de mensagem e ela o converte para o
   dialeto de cada upstream — `tools`/`input_schema` na API de mensagens
   da Anthropic, `tools`/`function` na compatível com OpenAI. A
   alternativa seria o cliente saber qual provedor está atrás de cada
   id de modelo, que é justamente o que esta rota existe para esconder.
   ────────────────────────────────────────────────────────────── */

import { NextRequest } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/currentUser";
import { getKieToken } from "@/lib/getKieToken";
import { chargeGeneration, refundCharge } from "@/lib/jobs/charge";
import { chatCredits } from "@/lib/jobs/chatCost";
import { mediaBytes } from "@/lib/productionMedia";
import { settleCredits } from "@/lib/saysell/client";
import sharp from "sharp";
import { ferramentasAnthropic, ferramentasOpenAI } from "@/lib/assistantTools";

/** Uma chamada de ferramenta, no formato neutro do cliente. */
interface ChamadaNeutra {
  id: string;
  name: string;
  /** Já desserializado — a rota reserializa no formato de cada dialeto. */
  arguments: Record<string, unknown>;
}

interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  /** Só em `assistant`: o que o modelo pediu no turno anterior. */
  toolCalls?: ChamadaNeutra[];
  /** Só em `tool`: a qual chamada este resultado responde. */
  toolCallId?: string;
  /** Só em `user`: as imagens que foram junto desta mensagem (URLs
      `/generated/...` ou `data:`). Ficam no histórico — um "@foto 1"
      citado três turnos depois ainda precisa da foto. */
  images?: string[];
}

/* ── Tradução para os dois dialetos ───────────────────────────
   O mesmo histórico, duas embalagens. Sem isto, um segundo turno depois
   de uma chamada de ferramenta é recusado pelos dois provedores: eles
   exigem que o pedido e o resultado apareçam no histórico. */

function paraAnthropic(m: Message): unknown {
  if (m.role === "tool") {
    return {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: m.toolCallId, content: m.content }],
    };
  }
  if (m.role === "assistant" && m.toolCalls?.length) {
    const blocos: unknown[] = [];
    if (m.content) blocos.push({ type: "text", text: m.content });
    for (const c of m.toolCalls) {
      blocos.push({ type: "tool_use", id: c.id, name: c.name, input: c.arguments });
    }
    return { role: "assistant", content: blocos };
  }
  return { role: m.role, content: m.content };
}

function paraOpenAI(m: Message): unknown {
  if (m.role === "tool") {
    return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
  }
  if (m.role === "assistant" && m.toolCalls?.length) {
    return {
      role: "assistant",
      content: m.content || null,
      tool_calls: m.toolCalls.map((c) => ({
        id: c.id,
        type: "function",
        function: { name: c.name, arguments: JSON.stringify(c.arguments) },
      })),
    };
  }
  return { role: m.role, content: m.content };
}

// Models that use OpenAI-compatible chat/completions endpoint
const OPENAI_COMPAT_ENDPOINTS: Record<string, string> = {
  "gemini-3-flash":  "https://api.kie.ai/gemini-3-flash/v1/chat/completions",
  "gemini-3.1-pro":  "https://api.kie.ai/gemini-3.1-pro/v1/chat/completions",
  "gpt-5-2":         "https://api.kie.ai/gpt-5-2/v1/chat/completions",
};

const AZURE_API_VERSION = "2024-04-01-preview";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = (await req.json()) as {
    messages?: Message[];
    prompt?: string;
    systemPrompt?: string;
    model?: string;
    images?: string[];
    /** true = ferramentas do projeto; "chat" inclui personagens e novos workflows. */
    tools?: boolean | "chat";
    azureEndpoint?: string;
    azureDeployment?: string;
    azureModelName?: string;
  };

  const model = body.model ?? "claude-sonnet-4-6";
  const chat = body.tools === "chat";
  const comFerramentas = body.tools === true || chat;
  let messages: Message[];

  if (body.messages && body.messages.length > 0) {
    messages = body.messages;
  } else if (body.prompt?.trim()) {
    messages = [];
    if (body.systemPrompt?.trim()) {
      messages.push({ role: "user", content: body.systemPrompt.trim() });
      messages.push({ role: "assistant", content: "Understood." });
    }
    messages.push({ role: "user", content: body.prompt.trim() });
  } else {
    return new Response(JSON.stringify({ error: "messages or prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  /* ── As imagens, por mensagem ─────────────────────────────────
     `body.images` (o jeito antigo) vale para a ÚLTIMA mensagem do
     usuário; `m.images` vale para a mensagem que as carrega. Cada URL é
     lida e reduzida uma vez só, mesmo citada em dois turnos. O teto é
     por pedido: acima dele as mais antigas caem primeiro, porque são as
     que menos pesam na decisão do turno. */
  const TETO_IMAGENS = 16;
  const ultimaDoUsuario = [...messages].reverse().find(m => m.role === "user");
  if (body.images?.length && ultimaDoUsuario) {
    ultimaDoUsuario.images = [...(ultimaDoUsuario.images ?? []), ...body.images];
  }
  const urlsUnicas: string[] = [];
  for (const m of messages) for (const u of m.images ?? []) if (!urlsUnicas.includes(u)) urlsUnicas.push(u);
  const permitidas = new Set(urlsUnicas.slice(-TETO_IMAGENS));
  const imagemPorUrl = new Map<string, string>();
  await Promise.all([...permitidas].map(async url => {
    try {
      const data = (await sharp(await mediaBytes(url)).resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()).toString("base64");
      imagemPorUrl.set(url, data);
    } catch (e) {
      console.warn("[assistant] imagem ignorada:", url.slice(0, 80), (e as Error)?.message);
    }
  }));
  const temImagens = imagemPorUrl.size > 0;
  const imagensDe = (m: Message) => (m.images ?? []).map(u => imagemPorUrl.get(u)).filter((d): d is string => !!d);
  const openAIVision = (m: Message) => {
    const dados = m.role === "user" ? imagensDe(m) : [];
    return dados.length
      ? { role: "user", content: [{ type: "text", text: m.content }, ...dados.map(data => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${data}` } }))] }
      : paraOpenAI(m);
  };
  const anthropicVision = (m: Message) => {
    const dados = m.role === "user" ? imagensDe(m) : [];
    return dados.length
      ? { role: "user", content: [{ type: "text", text: m.content }, ...dados.map(data => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } }))] }
      : paraAnthropic(m);
  };

  // ── Kie.ai models ─────────────────────────────────────────────────────────
  const apiKey = await getKieToken(req);
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Assistente indisponível no momento." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  // Cada mensagem debita créditos fixos por modelo (lib/jobs/chatCost.ts).
  const charge = await chargeGeneration(user.uid, { kind: "chat", model, resolution: "-", credits: chatCredits(model) });
  if (!charge.ok) return charge.response;

  const openaiEndpoint = OPENAI_COMPAT_ENDPOINTS[model];

  let upstream: Response;
  try {
  upstream = openaiEndpoint
    ? await fetch(openaiEndpoint, {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          /* Com ferramentas, a mensagem precisa carregar `tool_calls` e
             `tool_call_id`; o formato de bloco único de texto não os
             comporta. Sem elas, nada muda. */
          messages: comFerramentas || temImagens
            ? messages.map(openAIVision)
            : messages.map(m => ({
                role: m.role,
                content: [{ type: "text", text: m.content }],
              })),
          ...(comFerramentas ? { tools: ferramentasOpenAI(chat), tool_choice: "auto" } : {}),
          stream: true,
        }),
      })
    : await fetch("https://api.kie.ai/claude/v1/messages", {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          system: messages.filter(m => m.role === "system").map(m => m.content).join("\n\n"),
          messages: messages.map(anthropicVision).filter((_, i) => messages[i].role !== "system"),
          ...(comFerramentas ? { tools: ferramentasAnthropic(chat) } : {}),
          stream: true,
          /* O raciocínio estendido e o uso de ferramenta não convivem
             nesta versão da API: com os dois ligados o provedor recusa o
             pedido. Ferramenta vence — é o que a leva pede. */
          thinkingFlag: !comFerramentas,
          max_tokens: 4096,
        }),
      });

  } catch (error) {
    await refundCharge(user.uid, charge.creditJobId);
    return new Response(JSON.stringify({ error: `Assistente indisponível: ${(error as Error).message}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok) {
    await refundCharge(user.uid, charge.creditJobId);
    const errText = await upstream.text();
    return new Response(JSON.stringify({ error: errText }), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // A kie.ai devolve alguns erros (chave, saldo, modelo) com HTTP 200 e um
  // JSON `{ code, msg }` no lugar do stream. Isso não é resposta: estorna.
  if ((upstream.headers.get("content-type") ?? "").includes("application/json")) {
    const raw = await upstream.text();
    let corpo: { code?: number; msg?: string } = {};
    try {
      corpo = JSON.parse(raw) as typeof corpo;
    } catch {
      /* corpo não-JSON cai no erro genérico abaixo */
    }
    if (corpo.code === undefined || corpo.code !== 200) {
      await refundCharge(user.uid, charge.creditJobId);
      console.error("[assistant] kie.ai recusou:", corpo.code, corpo.msg ?? raw.slice(0, 200));
      return new Response(JSON.stringify({ error: "Assistente indisponível no momento. Tente de novo." }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    // JSON com code 200 sem stream: devolve como veio, cobrado.
    await settleCredits(user.uid, charge.creditJobId, "committed").catch((err) =>
      console.error("[assistant] confirmação do crédito falhou:", err),
    );
    return new Response(raw, { headers: { "Content-Type": "application/json" } });
  }

  // O provedor aceitou: a mensagem está cobrada.
  await settleCredits(user.uid, charge.creditJobId, "committed").catch((err) =>
    console.error("[assistant] confirmação do crédito falhou:", err),
  );

  return new Response(upstream.body, {
    headers: {
      "Content-Type":       "text/event-stream",
      "Cache-Control":      "no-cache, no-transform",
      "Connection":         "keep-alive",
      "X-Accel-Buffering":  "no",
    },
  });
}
