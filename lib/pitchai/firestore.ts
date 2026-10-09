/* ============================================================
   FIRESTORE DO PITCHAI — a REST, sem SDK

   Duas coisas só: paginar uma coleção inteira e desembrulhar o formato
   de valores do Firestore, que envelopa cada campo no seu tipo
   (`{stringValue: "x"}`, `{integerValue: "3"}`, e por aí).

   O `integerValue` chega como STRING no JSON — o Firestore guarda
   inteiros de 64 bits e o JSON não os representa sem perda. Converter
   com `Number` é seguro para os campos que lemos (vendas, preço em
   centavos); o id do produto do TikTok, que estoura 2^53, é `string` na
   origem e continua string aqui.
   ============================================================ */

import { bancoDoPitchai, projetoDoPitchai, tokenDoPitchai } from "./credencial";

/** O envelope de um valor, como a REST devolve. */
type ValorFirestore = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: null;
  timestampValue?: string;
  arrayValue?: { values?: ValorFirestore[] };
  mapValue?: { fields?: Record<string, ValorFirestore> };
};

type DocumentoFirestore = {
  name: string;
  fields?: Record<string, ValorFirestore>;
};

export type Documento = { id: string; campos: Record<string, unknown> };

export function desembrulhar(v: ValorFirestore | undefined): unknown {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue !== undefined) return (v.arrayValue.values ?? []).map(desembrulhar);
  if (v.mapValue !== undefined) {
    return Object.fromEntries(
      Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, desembrulhar(x)]),
    );
  }
  return null;
}

function base(): string {
  return `https://firestore.googleapis.com/v1/projects/${projetoDoPitchai()}/databases/${bancoDoPitchai()}/documents`;
}

/**
 * Lê uma coleção inteira, paginando. `limite` corta a leitura — a base de
 * capturados passa de 300 documentos e nem sempre queremos todos.
 *
 * `mask` pede só os campos que interessam. Não é frescura: `captured_products`
 * carrega `image_data` (uma data URL de até 700 mil caracteres) e `description`,
 * e trazer isso vezes 300 são dezenas de megabytes atravessando a rede para
 * desenhar uma grade de miniaturas.
 */
export async function lerColecao(
  colecao: string,
  opcoes: { limite?: number; campos?: string[] } = {},
): Promise<Documento[]> {
  const token = await tokenDoPitchai();
  const saida: Documento[] = [];
  let proxima: string | undefined;

  do {
    const url = new URL(`${base()}/${colecao}`);
    url.searchParams.set("pageSize", String(Math.min(300, opcoes.limite ?? 300)));
    if (proxima) url.searchParams.set("pageToken", proxima);
    for (const campo of opcoes.campos ?? []) url.searchParams.append("mask.fieldPaths", campo);

    const resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resposta.ok) {
      const erro = (await resposta.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(
        `Firestore recusou a leitura de ${colecao}: ${erro.error?.message ?? `HTTP ${resposta.status}`}`,
      );
    }

    const corpo = (await resposta.json()) as {
      documents?: DocumentoFirestore[];
      nextPageToken?: string;
    };

    for (const doc of corpo.documents ?? []) {
      saida.push({
        id: doc.name.split("/").pop() ?? "",
        campos: Object.fromEntries(
          Object.entries(doc.fields ?? {}).map(([k, v]) => [k, desembrulhar(v)]),
        ),
      });
      if (opcoes.limite && saida.length >= opcoes.limite) return saida;
    }

    proxima = corpo.nextPageToken;
  } while (proxima);

  return saida;
}
