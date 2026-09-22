/* ============================================================
   MOTOR DE TENDÊNCIAS — passo 4.1: trazer o vídeo para o acervo local

   Dois caminhos, o mesmo destino (`/generated/tendencias/...`):

   - LINK (TikTok/Instagram): resolvido pelo `yt-dlp`, se estiver no PATH —
     o mesmo contrato do `ffmpeg` em `lib/productionMedia.ts`: o app usa,
     nunca instala. Sem ele, erro com código `ytdlp_ausente` e a mensagem
     que manda instalar OU enviar o mp4. O PATH é o do processo: quem
     instala com o app aberto precisa reiniciá-lo, e a mensagem diz isso.
   - ARQUIVO: o mp4 já subiu por `/api/upload-video`; aqui só se confere
     que a URL é do acervo e que o ffprobe lê um vídeo nela.

   O vídeo baixado NÃO entra na tabela `uploads`, de propósito: é isso que o
   põe no Acervo, com botão de baixar. A referência existe para derivar
   estrutura e movimento, não para ser republicada.
   ============================================================ */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { join, resolve, sep, extname } from "node:path";
import { tmpdir } from "node:os";
import { MEDIA_DIR } from "@/lib/guest/paths";
import { uploadBuffer } from "@/lib/storage";
import {
  MENSAGEM_YTDLP_AUSENTE,
  origemDoLink,
  type CodigoErroImportacao,
  type MetricasTendencia,
  type OrigemTendencia,
} from "./tipos";

const exec = promisify(execFile);

/** O mesmo teto de `/api/upload-video`: os dois caminhos aceitam o mesmo vídeo. */
const LIMITE_MB = 100;

export class ErroImportacao extends Error {
  constructor(readonly codigo: CodigoErroImportacao, mensagem: string) {
    super(mensagem);
  }
}

/** Não guarda cache: se o usuário instalar e reiniciar, a próxima chamada já vê. */
export async function versaoYtdlp(): Promise<string | null> {
  try {
    const { stdout } = await exec("yt-dlp", ["--version"], { windowsHide: true, timeout: 15_000 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export interface VideoImportado {
  origem: OrigemTendencia;
  chaveOrigem: string;
  linkOrigem: string | null;
  handle: string | null;
  legenda: string | null;
  duracao: number | null;
  metricas: MetricasTendencia;
  videoUrl: string;
}

/** Os campos do `--dump-json` do yt-dlp que usamos. Todos opcionais: cada extrator traz um pedaço. */
interface InfoYtdlp {
  id?: string;
  extractor_key?: string;
  webpage_url?: string;
  uploader?: string;
  uploader_id?: string;
  channel?: string;
  description?: string;
  title?: string;
  duration?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  repost_count?: number;
}

const MIME_POR_EXTENSAO: Record<string, string> = { ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".mkv": "video/x-matroska" };

const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);
const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Última linha útil do stderr do yt-dlp, sem o prefixo "ERROR:". */
function motivoYtdlp(stderr: string): string {
  const linhas = stderr.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const erro = [...linhas].reverse().find(l => l.startsWith("ERROR:")) ?? linhas.at(-1) ?? "";
  return erro.replace(/^ERROR:\s*/, "").slice(0, 300);
}

export async function importarPorLink(link: string): Promise<VideoImportado> {
  const origem = origemDoLink(link);
  if (!origem) throw new ErroImportacao("link_invalido", "Cole um link público do TikTok ou do Instagram.");
  if (!(await versaoYtdlp())) throw new ErroImportacao("ytdlp_ausente", MENSAGEM_YTDLP_AUSENTE);

  const pasta = await mkdtemp(join(tmpdir(), "pitch-tendencia-"));
  try {
    let stdout: string;
    try {
      ({ stdout } = await exec("yt-dlp", [
        "--no-playlist", "--no-warnings", "--no-progress",
        // Um arquivo só, já com áudio: sem mesclagem, sem depender do ffmpeg aqui.
        "-f", "b[ext=mp4]/b",
        "--max-filesize", `${LIMITE_MB}M`,
        "--dump-json", "--no-simulate",
        "-o", join(pasta, "video.%(ext)s"),
        link.trim(),
      ], { windowsHide: true, timeout: 180_000, maxBuffer: 16 * 1024 * 1024 }));
    } catch (e) {
      const stderr = String((e as { stderr?: unknown }).stderr ?? "");
      const motivo = motivoYtdlp(stderr) || (e instanceof Error ? e.message : String(e));
      if (/login|cookies|rate-limit/i.test(motivo)) {
        throw new ErroImportacao("login_exigido",
          `${origem === "instagram" ? "O Instagram" : "A plataforma"} exigiu login para liberar este vídeo. Baixe o vídeo pelo app e envie o arquivo mp4. (yt-dlp: ${motivo})`);
      }
      throw new ErroImportacao("falha_download", `Não foi possível baixar o vídeo deste link. Confira se o post é público ou envie o arquivo mp4. (yt-dlp: ${motivo})`);
    }

    const arquivo = (await readdir(pasta)).find(n => n.startsWith("video."));
    if (!arquivo) {
      throw new ErroImportacao("falha_download", `O yt-dlp não salvou nenhum vídeo (o post pode passar de ${LIMITE_MB} MB ou ser só fotos). Envie o arquivo mp4.`);
    }
    const mime = MIME_POR_EXTENSAO[extname(arquivo).toLowerCase()];
    if (!mime) throw new ErroImportacao("video_invalido", `Formato de vídeo não suportado (${extname(arquivo)}). Envie o arquivo mp4.`);

    let info: InfoYtdlp = {};
    try {
      info = JSON.parse(stdout.trim().split(/\r?\n/).at(-1) ?? "{}") as InfoYtdlp;
    } catch { /* sem metadados: o vídeo ainda serve */ }

    const videoUrl = await uploadBuffer(await readFile(join(pasta, arquivo)), mime, "tendencias");
    const id = texto(info.id);
    return {
      origem,
      chaveOrigem: id ? `${origem}:${id}` : `${origem}:${videoUrl}`,
      linkOrigem: texto(info.webpage_url) ?? link.trim(),
      // TikTok: `uploader` é o @; Instagram: o @ vem em `channel`.
      handle: (origem === "tiktok" ? texto(info.uploader) ?? texto(info.channel) : texto(info.channel) ?? texto(info.uploader_id))?.replace(/^@/, "") ?? null,
      legenda: texto(info.description) ?? texto(info.title),
      duracao: numero(info.duration) ?? null,
      metricas: {
        views: numero(info.view_count),
        likes: numero(info.like_count),
        comentarios: numero(info.comment_count),
        compartilhamentos: numero(info.repost_count),
      },
      videoUrl,
    };
  } finally {
    await rm(pasta, { recursive: true, force: true }).catch(() => {});
  }
}

export async function importarArquivo(videoUrl: string): Promise<VideoImportado> {
  if (typeof videoUrl !== "string" || !videoUrl.startsWith("/generated/")) {
    throw new ErroImportacao("video_invalido", "Envie o vídeo para o acervo antes de importar.");
  }
  const caminho = resolve(MEDIA_DIR, decodeURIComponent(videoUrl.slice("/generated/".length)));
  if (!caminho.startsWith(resolve(MEDIA_DIR) + sep)) throw new ErroImportacao("video_invalido", "Caminho de mídia inválido.");
  try {
    await stat(caminho);
  } catch {
    throw new ErroImportacao("video_invalido", "O vídeo enviado não está mais no acervo. Envie de novo.");
  }

  let duracao: number | null = null;
  try {
    const { stdout } = await exec("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_type:format=duration", "-of", "json", caminho], { windowsHide: true, timeout: 30_000 });
    const info = JSON.parse(stdout) as { streams?: { codec_type?: string }[]; format?: { duration?: string } };
    if (!info.streams?.some(s => s.codec_type === "video")) throw new Error("sem vídeo");
    duracao = numero(Number(info.format?.duration)) ?? null;
  } catch {
    throw new ErroImportacao("video_invalido", "Esse arquivo não parece um vídeo legível. Envie um mp4.");
  }

  return {
    origem: "upload",
    // O acervo deduplica por hash: o mesmo arquivo enviado duas vezes volta com a mesma URL.
    chaveOrigem: `upload:${videoUrl}`,
    linkOrigem: null,
    handle: null,
    legenda: null,
    duracao,
    metricas: {},
    videoUrl,
  };
}
