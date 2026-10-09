/* ============================================================
   PRODUTOS QUENTES — o que o Pitch lê do PitchAI

   Do outro lado há DUAS coleções, e nenhuma sozinha serve:

   `ranked_products` é a vitrine curada — os quentes de verdade, com
   vendas, receita, comissão e a ordem que a curadoria escolheu. Medida
   hoje: 4 produtos, e em 2 deles a foto é uma data URL de miniatura
   (11 a 14 mil caracteres, algo em torno de 100px). Serve para o cartão
   da lista; não serve para recortar e virar cena de vídeo.

   `captured_products` é o staging da captura — 316 produtos, TODOS com
   `image_url` apontando para o CDN em 800×800, que responde. É o
   material bom. Em compensação não tem ranking: `vendas` e `receita`
   podem vir vazias, e o status de 314 deles é "novo" (não passaram pela
   curadoria).

   Então a junção é esta: a vitrine manda na ORDEM e nos NÚMEROS, o
   staging manda na FOTO. Um produto da vitrine cuja foto seja data URL
   e que exista no staging pega a foto de 800px de lá. É a única razão
   de este arquivo ler as duas.

   ── Sobre a resolução ───────────────────────────────────────────────
   A URL do CDN traz o recorte no próprio caminho
   (`~tplv-aphluv4xwc-resize-webp:800:800.webp`). Dá para supor que
   trocar `800:800` por mais renderia uma foto maior, e não fizemos isso:
   é um CDN de terceiro, a suposição pode devolver 403 em massa e 800px
   já é o suficiente para o recorte. Se um dia faltar resolução, o lugar
   de mexer é aqui.
   ============================================================ */

import { lerColecao } from "./firestore";

export type ProdutoQuente = {
  /** O id do documento — único dentro da origem. */
  id: string;
  /** Id do produto no TikTok. É o que costura vitrine e staging. */
  pid: string | null;
  nome: string;
  /** Em reais. 0 quando a fonte não informou. */
  preco: number;
  /** Unidades vendidas no período, quando a fonte informar. */
  vendas: number | null;
  /** Receita em reais, quando a fonte informar. */
  receita: number | null;
  categoria: string | null;
  comissao: number | null;
  /** A página do produto, para conferir a peça antes de usar. */
  link: string | null;
  /** A melhor foto disponível — CDN de 800px quando existir. */
  imagem: string | null;
  /** `true` quando a foto é uma data URL de miniatura, não uma do CDN. */
  imagemFraca: boolean;
  /** De onde o produto veio: a vitrine curada ou a base de captura. */
  origem: "vitrine" | "base";
  destaque: boolean;
};

/** Só os campos que a grade usa — ver a nota sobre `mask` em `firestore.ts`. */
const CAMPOS_VITRINE = [
  "nome", "tiktok_product_id", "preco", "vendas", "receita",
  "categoria", "comissao_pct", "link", "imagem_url", "destaque", "ordem",
];

const CAMPOS_BASE = [
  "name", "tiktok_product_id", "price_cents", "sold_count", "revenue",
  "category", "commission_pct", "product_url", "image_url", "status",
];

const texto = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const numero = (v: unknown): number | null => (typeof v === "number" ? v : null);

/** Data URL = miniatura embutida no documento; http(s) = CDN em 800px. */
function ehFraca(url: string | null): boolean {
  return !!url && url.startsWith("data:");
}

export type OpcoesQuentes = {
  /** Inclui os capturados que ainda não foram para a vitrine. */
  incluirBase?: boolean;
  /** Teto de itens da base. A vitrine vem inteira, que hoje são 4. */
  limiteBase?: number;
};

export async function lerQuentes(opcoes: OpcoesQuentes = {}): Promise<ProdutoQuente[]> {
  const { incluirBase = true, limiteBase = 120 } = opcoes;

  const [vitrine, base] = await Promise.all([
    lerColecao("ranked_products", { campos: CAMPOS_VITRINE }),
    /* A base é lida mesmo com `incluirBase: false`: ela é a fonte das fotos
       de 800px da vitrine. O que a opção controla é se os produtos que só
       existem nela aparecem na lista. */
    lerColecao("captured_products", { campos: CAMPOS_BASE, limite: incluirBase ? limiteBase : 300 }),
  ]);

  /* Índice do staging por pid, para a vitrine achar a foto boa. */
  const fotoDoStaging = new Map<string, string>();
  for (const doc of base) {
    const pid = texto(doc.campos.tiktok_product_id) ?? doc.id;
    const url = texto(doc.campos.image_url);
    if (pid && url && !ehFraca(url)) fotoDoStaging.set(pid, url);
  }

  const daVitrine: ProdutoQuente[] = vitrine
    .map((doc, i) => {
      const pid = texto(doc.campos.tiktok_product_id);
      const propria = texto(doc.campos.imagem_url);
      /* A troca que justifica ler as duas coleções: a miniatura embutida
         cede lugar à foto de 800px quando o mesmo produto existe lá. */
      const doStaging = pid ? fotoDoStaging.get(pid) ?? null : null;
      const imagem = ehFraca(propria) && doStaging ? doStaging : propria ?? doStaging;

      return {
        id: doc.id,
        pid,
        nome: texto(doc.campos.nome) ?? "Sem nome",
        preco: numero(doc.campos.preco) ?? 0,
        vendas: numero(doc.campos.vendas),
        receita: numero(doc.campos.receita),
        categoria: texto(doc.campos.categoria),
        comissao: numero(doc.campos.comissao_pct),
        link: texto(doc.campos.link),
        imagem,
        imagemFraca: ehFraca(imagem),
        origem: "vitrine" as const,
        destaque: doc.campos.destaque === true,
        _ordem: numero(doc.campos.ordem) ?? i,
      };
    })
    /* A ordem da curadoria primeiro; empate desempata pelo destaque. */
    .sort((a, b) => (a._ordem - b._ordem) || Number(b.destaque) - Number(a.destaque))
    .map(({ _ordem, ...p }) => { void _ordem; return p; });

  if (!incluirBase) return daVitrine;

  const jaNaVitrine = new Set(daVitrine.map((p) => p.pid).filter(Boolean));

  const daBase: ProdutoQuente[] = base
    .filter((doc) => {
      const pid = texto(doc.campos.tiktok_product_id) ?? doc.id;
      return !jaNaVitrine.has(pid);
    })
    .map((doc) => {
      const centavos = numero(doc.campos.price_cents);
      return {
        id: doc.id,
        pid: texto(doc.campos.tiktok_product_id) ?? doc.id,
        nome: texto(doc.campos.name) ?? "Sem nome",
        preco: centavos === null ? 0 : centavos / 100,
        vendas: numero(doc.campos.sold_count),
        receita: numero(doc.campos.revenue),
        categoria: texto(doc.campos.category),
        comissao: numero(doc.campos.commission_pct),
        link: texto(doc.campos.product_url),
        imagem: texto(doc.campos.image_url),
        imagemFraca: ehFraca(texto(doc.campos.image_url)),
        origem: "base" as const,
        /* "publicado" no staging quer dizer que já foi para a vitrine —
           é o mais perto de destaque que a base tem. */
        destaque: doc.campos.status === "publicado",
      };
    })
    /* Sem ordem de curadoria, o que ordena é a venda; quem não informou
       venda vai para o fim, não para a frente com zero. */
    .sort((a, b) => (b.vendas ?? -1) - (a.vendas ?? -1))
    .slice(0, limiteBase);

  return [...daVitrine, ...daBase];
}
