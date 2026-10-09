"use client";

/* ============================================================
   UM TURNO DO ASSISTENTE, LIDO DO FLUXO

   Lê o SSE da rota e devolve o que o modelo disse e o que ele pediu.
   Existe separado porque, com ferramentas, um pedido do usuário deixa de
   ser um turno e vira uma conversa curta: o modelo chama, o app executa,
   o app responde, o modelo narra. Ter isso dentro do componente seria
   um callback de duzentas linhas com três responsabilidades.

   ── Os dois dialetos, de novo ──
   A rota já traduz o que VAI. O que VOLTA é fluxo bruto do provedor, e
   os dois formatos convivem aqui:

     Anthropic  `content_block_start` abre um `tool_use` com id e nome;
                `input_json_delta` traz o JSON dos argumentos em pedaços;
                `content_block_stop` fecha.
     OpenAI     `choices[].delta.tool_calls[]`, com o mesmo JSON chegando
                aos pedaços em `function.arguments`, indexado por `index`.

   Nos dois casos os argumentos chegam como texto partido. Só dá para
   desserializar no fim — tentar a cada pedaço produz erro em todos menos
   no último.
   ============================================================ */

export type ChamadaCrua = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type Turno = {
  texto: string;
  chamadas: ChamadaCrua[];
  /** Preenchido quando o provedor abriu o fluxo e falhou no meio dele. */
  falha: string | null;
};

/** O acumulador de uma chamada enquanto o JSON dela chega partido. */
type EmMontagem = { id: string; name: string; bruto: string };

export async function lerTurno(
  corpo: ReadableStream<Uint8Array>,
  aoTexto: (parcial: string) => void,
): Promise<Turno> {
  const leitor = corpo.getReader();
  const decodificador = new TextDecoder();

  let sobra = "";
  let texto = "";
  let falha: string | null = null;
  const emMontagem = new Map<number, EmMontagem>();

  while (true) {
    const { done, value } = await leitor.read();
    if (done && !sobra) break;

    sobra += done ? `${decodificador.decode()}\n` : decodificador.decode(value, { stream: true });
    const linhas = sobra.split("\n");
    sobra = linhas.pop() ?? "";

    for (const linha of linhas) {
      if (!linha.startsWith("data:")) continue;
      const json = linha.slice(5).trim();
      if (json === "[DONE]") continue;

      let p: Record<string, unknown>;
      try {
        p = JSON.parse(json) as Record<string, unknown>;
      } catch {
        /* evento SSE partido ao meio entre duas leituras */
        continue;
      }

      /* O provedor pode abrir com 200 e falhar no meio — foi assim que
         apareceu `no_available_account`. Sem ler isto, a falha viraria
         uma resposta vazia e aparentemente bem-sucedida. */
      if (p.type === "error" || p.error) {
        const e = p.error as { message?: string } | undefined;
        falha = e?.message ?? "o provedor interrompeu a resposta";
        continue;
      }

      /* ── Anthropic ── */
      if (p.type === "content_block_start") {
        const bloco = p.content_block as { type?: string; id?: string; name?: string } | undefined;
        if (bloco?.type === "tool_use") {
          emMontagem.set(Number(p.index ?? 0), {
            id: bloco.id ?? `tool-${emMontagem.size}`,
            name: bloco.name ?? "",
            bruto: "",
          });
        }
        continue;
      }

      if (p.type === "content_block_delta") {
        const d = p.delta as { type?: string; text?: string; partial_json?: string } | undefined;
        if (typeof d?.text === "string") {
          texto += d.text;
          aoTexto(texto);
        } else if (typeof d?.partial_json === "string") {
          const alvo = emMontagem.get(Number(p.index ?? 0));
          if (alvo) alvo.bruto += d.partial_json;
        }
        continue;
      }

      /* ── OpenAI ── */
      const escolha = (p.choices as { delta?: Record<string, unknown> }[] | undefined)?.[0];
      const finish = (p.choices as { finish_reason?: string }[] | undefined)?.[0]?.finish_reason;
      const stop = (p.delta as { stop_reason?: string } | undefined)?.stop_reason;
      if (finish === "length" || finish === "content_filter" || stop === "max_tokens") {
        falha = "A resposta foi interrompida pelo provedor. Peça uma criação menor ou tente novamente.";
      }
      const delta = escolha?.delta;
      if (!delta) continue;

      if (typeof delta.content === "string" && delta.content) {
        texto += delta.content;
        aoTexto(texto);
      }

      const chamadas = delta.tool_calls as
        | { index?: number; id?: string; function?: { name?: string; arguments?: string } }[]
        | undefined;
      if (!chamadas) continue;

      for (const c of chamadas) {
        const i = Number(c.index ?? 0);
        const atual = emMontagem.get(i) ?? { id: "", name: "", bruto: "" };
        if (c.id) atual.id = c.id;
        if (c.function?.name) atual.name = c.function.name;
        if (c.function?.arguments) atual.bruto += c.function.arguments;
        emMontagem.set(i, atual);
      }
    }
    if (done) break;
  }

  /* Só agora dá para desserializar: antes do fim o JSON está partido. */
  const chamadas: ChamadaCrua[] = [];
  for (const [i, m] of emMontagem) {
    if (!m.name) continue;
    let args: Record<string, unknown> = {};
    try {
      args = m.bruto.trim() ? (JSON.parse(m.bruto) as Record<string, unknown>) : {};
    } catch {
      falha = falha ?? `o modelo mandou argumentos inválidos para ${m.name}`;
      continue;
    }
    chamadas.push({ id: m.id || `tool-${i}`, name: m.name, arguments: args });
  }

  return { texto, chamadas, falha };
}
