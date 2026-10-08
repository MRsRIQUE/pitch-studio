/* ============================================================
   GET /api/quentes/imagem?u=<url> — a foto do produto, servida por nós

   Por que passar por aqui em vez de pôr a URL do CDN no `<img>`:

   1. As fotos vêm de CDN de terceiro. Hotlink de fora do TikTok é o tipo
      de coisa que funciona hoje e passa a devolver 403 sem aviso — e
      quando quebra, quebra a grade inteira de uma vez.
   2. `s.500fd.com` serve WebP. O canvas e os modelos de edição lidam bem,
      mas o `?png=1` existe para quando não lidarem.
   3. Cache. O navegador guarda por um dia e a grade para de bater no CDN
      a cada abertura do painel.

   ── A lista de hosts NÃO é frescura ─────────────────────────────────
   Uma rota que baixa a URL que o cliente mandar é um SSRF: alguém pede
   `?u=http://localhost:3100/api/settings` e o servidor busca por ele,
   de dentro da máquina, e devolve. A lista fecha isso nos dois hosts que
   a base realmente usa — medidos: 301 documentos em `s.500fd.com` e 17
   em `p16-oec-sg.ibyteimg.com`.
   ============================================================ */

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const dynamic = "force-dynamic";

/** Sufixos de host aceitos. Subdomínio novo do mesmo CDN passa; outro host, não. */
const HOSTS = [".500fd.com", ".ibyteimg.com", ".tiktokcdn.com", ".tiktokcdn-us.com"];

function permitido(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return HOSTS.some((sufixo) => host === sufixo.slice(1) || host.endsWith(sufixo));
}

export async function GET(req: NextRequest) {
  const bruto = req.nextUrl.searchParams.get("u");
  if (!bruto) return NextResponse.json({ erro: "falta u" }, { status: 400 });

  let alvo: URL;
  try {
    alvo = new URL(bruto);
  } catch {
    return NextResponse.json({ erro: "url inválida" }, { status: 400 });
  }
  if (!permitido(alvo)) {
    return NextResponse.json({ erro: "host não permitido" }, { status: 403 });
  }

  let resposta: Response;
  try {
    resposta = await fetch(alvo, {
      /* Sem Referer: o CDN decide por ele, e mandar o nosso localhost só
         daria a ele um motivo a mais para recusar. */
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return NextResponse.json({ erro: "cdn inacessível" }, { status: 502 });
  }

  if (!resposta.ok) {
    return NextResponse.json({ erro: `cdn respondeu ${resposta.status}` }, { status: 502 });
  }

  const bytes = Buffer.from(await resposta.arrayBuffer());
  const tipoOriginal = resposta.headers.get("content-type") ?? "image/jpeg";

  const comum = {
    /* Um dia no navegador, e `immutable` porque a URL do CDN carrega o
       hash do arquivo — o conteúdo daquele endereço não muda. */
    "Cache-Control": "public, max-age=86400, immutable",
  };

  if (req.nextUrl.searchParams.get("png") === "1") {
    const png = await sharp(bytes).png().toBuffer();
    return new NextResponse(new Uint8Array(png), {
      headers: { ...comum, "Content-Type": "image/png" },
    });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: { ...comum, "Content-Type": tipoOriginal },
  });
}
