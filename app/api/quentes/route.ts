/* ============================================================
   GET /api/quentes — a lista de produtos quentes do PitchAI

   Rota de servidor porque a credencial é de servidor: a conta de serviço
   assina como administradora do projeto do PitchAI e não pode existir no
   navegador. O cliente vê só o resultado.

   O cache de 5 minutos não é otimização prematura: o painel remonta a
   cada entrada em projeto, e sem ele cada abertura seriam duas leituras
   de coleção inteira no Firestore de produção — que é cobrado por
   documento lido.
   ============================================================ */

import { NextRequest, NextResponse } from "next/server";
import { lerQuentes, type ProdutoQuente } from "@/lib/pitchai/quentes";
import { SemCredencial } from "@/lib/pitchai/credencial";

export const dynamic = "force-dynamic";

const VALIDADE_MS = 5 * 60_000;

let cache: { chave: string; em: number; itens: ProdutoQuente[] } | null = null;

export async function GET(req: NextRequest) {
  const incluirBase = req.nextUrl.searchParams.get("base") !== "0";
  const chave = incluirBase ? "com-base" : "so-vitrine";
  const recarregar = req.nextUrl.searchParams.get("recarregar") === "1";

  if (!recarregar && cache && cache.chave === chave && Date.now() - cache.em < VALIDADE_MS) {
    return NextResponse.json({ itens: cache.itens, doCache: true });
  }

  try {
    const itens = await lerQuentes({ incluirBase });
    cache = { chave, em: Date.now(), itens };
    return NextResponse.json({ itens, doCache: false });
  } catch (erro) {
    /* Falta de credencial não é falha do servidor — é configuração que
       ainda não foi feita. O painel desenha um estado próprio para isso,
       com o passo que falta, em vez de um "erro" sem saída. */
    if (erro instanceof SemCredencial) {
      return NextResponse.json({ erro: "sem_credencial", detalhe: erro.message }, { status: 503 });
    }
    const detalhe = erro instanceof Error ? erro.message : String(erro);
    console.error("[quentes] leitura falhou:", detalhe);
    return NextResponse.json({ erro: "leitura_falhou", detalhe }, { status: 502 });
  }
}
