// Atualiza lib/generation-pricing.json com os preços ao vivo da kie.ai.
//
// A fonte é a mesma API pública que alimenta https://kie.ai/pricing. O Studio
// reserva créditos por esta tabela antes de cada geração: se a kie.ai sobe um
// preço e a tabela fica velha, o SaySell paga a diferença. Rode de tempos em
// tempos e faça deploy:
//
//   node scripts/atualizar-precos-kie.mjs
import { writeFile } from "node:fs/promises";

const API = "https://api.kie.ai/client/v1/model-pricing/page";
const rates = [];
for (let pageNum = 1; pageNum <= 50; pageNum++) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pageNum, pageSize: 100 }),
  });
  const body = await res.json();
  if (body.code !== 200) throw new Error(`kie.ai respondeu ${body.code}: ${body.msg}`);
  const records = body.data?.records ?? [];
  rates.push(...records);
  if (records.length < 100) break;
}
if (rates.length < 400) throw new Error(`Só ${rates.length} linhas — algo mudou na API; tabela não regravada.`);

const checkedAt = new Date().toISOString().slice(0, 10);
await writeFile(
  new URL("../lib/generation-pricing.json", import.meta.url),
  JSON.stringify({ source: "https://kie.ai/pricing (api.kie.ai/client/v1/model-pricing/page)", checkedAt, rates }, null, 2) + "\n",
);
console.log(`${rates.length} linhas gravadas (${checkedAt}).`);
