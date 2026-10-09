/**
 * /api/tendencias — motor de tendências, passo 4.1 (importar).
 *
 * GET               → { tendencias, ytdlp: { disponivel, versao } }
 * POST { url | videoUrl, direitoConfirmado: true } → { tendencia, jaExistia }
 * DELETE ?id=...    → { ok: true }
 *
 * Erros de importação voltam com `codigo` (ver `CodigoErroImportacao`), para a
 * tela escolher a mensagem sem depender do texto.
 */
import { NextRequest, NextResponse } from "next/server";
import { GUEST_USER_ID } from "@/lib/guestMode";
import { inserirTendencia, listarTendencias, removerTendencia, tendenciaPorChave } from "@/lib/tendencias/db";
import { ErroImportacao, importarArquivo, importarPorLink, versaoYtdlp } from "@/lib/tendencias/importar";
import type { ListaTendencias, PedidoImportacao, RespostaImportacao } from "@/lib/tendencias/tipos";

export const maxDuration = 300;

export async function GET() {
  const versao = await versaoYtdlp();
  const corpo: ListaTendencias = {
    tendencias: listarTendencias(GUEST_USER_ID),
    ytdlp: { disponivel: versao !== null, versao },
  };
  return NextResponse.json(corpo);
}

export async function POST(req: NextRequest) {
  let pedido: PedidoImportacao;
  try {
    pedido = (await req.json()) as PedidoImportacao;
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  if (pedido.direitoConfirmado !== true) {
    return NextResponse.json(
      { error: "Confirme que você tem o direito de usar este vídeo.", codigo: "direito_nao_confirmado" },
      { status: 400 },
    );
  }

  try {
    const url = typeof pedido.url === "string" ? pedido.url.trim() : "";
    const video = url
      ? await importarPorLink(url)
      : await importarArquivo(pedido.videoUrl ?? "");

    const existente = tendenciaPorChave(GUEST_USER_ID, video.chaveOrigem);
    const corpo: RespostaImportacao = existente
      ? { tendencia: existente, jaExistia: true }
      : { tendencia: inserirTendencia(GUEST_USER_ID, video), jaExistia: false };
    return NextResponse.json(corpo);
  } catch (e) {
    if (e instanceof ErroImportacao) {
      const status = e.codigo === "falha_download" || e.codigo === "login_exigido" ? 502 : 400;
      return NextResponse.json({ error: e.message, codigo: e.codigo }, { status });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta o id." }, { status: 400 });
  if (!removerTendencia(GUEST_USER_ID, id)) return NextResponse.json({ error: "Tendência não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
