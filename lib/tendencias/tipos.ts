/* ============================================================
   MOTOR DE TENDÊNCIAS — os tipos que cliente e servidor dividem

   Uma tendência é um post que já provou performar (TikTok, Reels ou um
   mp4 enviado), guardado no acervo local para DERIVAR estrutura e
   movimento — nunca para republicar. Ver `docs/roadmap-motor-tendencias.md`.

   O ciclo de vida acompanha as etapas da ingestão (§7 da nota da Orior):
   `importada` (4.1) → `fatiando` (4.2) → `analisando` (4.3) → `pronta`.
   `erro` guarda em que etapa parou em `erro`, para re-tentar só ela.
   ============================================================ */

export type OrigemTendencia = "tiktok" | "instagram" | "upload";

export type StatusTendencia = "importada" | "fatiando" | "analisando" | "pronta" | "erro";

/** Métricas da fonte, quando o yt-dlp as traz. Ausente = a fonte não informou. */
export interface MetricasTendencia {
  views?: number;
  likes?: number;
  comentarios?: number;
  compartilhamentos?: number;
}

export interface Tendencia {
  id: string;
  origem: OrigemTendencia;
  /** O link colado pelo usuário (ou o canônico, quando o yt-dlp o resolve). */
  linkOrigem: string | null;
  /** Handle do criador original, sem "@". */
  handle: string | null;
  legenda: string | null;
  duracao: number | null;
  metricas: MetricasTendencia;
  /** `/generated/...` — a cópia local do vídeo. */
  videoUrl: string;
  status: StatusTendencia;
  erro: string | null;
  /** Quando o usuário marcou "tenho o direito de usar este vídeo". */
  direitoConfirmadoEm: string;
  criadaEm: string;
}

/** Resposta de `GET /api/tendencias`. */
export interface ListaTendencias {
  tendencias: Tendencia[];
  ytdlp: { disponivel: boolean; versao: string | null };
}

/** Corpo de `POST /api/tendencias`: um link OU um vídeo já enviado ao acervo. */
export interface PedidoImportacao {
  url?: string;
  videoUrl?: string;
  direitoConfirmado: boolean;
}

/** Resposta de `POST /api/tendencias`. `jaExistia` = o mesmo post já estava importado. */
export interface RespostaImportacao {
  tendencia: Tendencia;
  jaExistia: boolean;
}

/** Erro com código, para a tela escolher a mensagem sem ler texto. */
export type CodigoErroImportacao =
  | "ytdlp_ausente"
  | "link_invalido"
  | "login_exigido"
  | "falha_download"
  | "direito_nao_confirmado"
  | "video_invalido";

export const MENSAGEM_YTDLP_AUSENTE =
  "Importar por link precisa do yt-dlp, que não está instalado. Instale com `winget install yt-dlp` (e reinicie o Pitch Studio) ou envie o arquivo mp4.";

const HOSTS_TIKTOK = ["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"];
const HOSTS_INSTAGRAM = ["instagram.com", "www.instagram.com"];

/** Diz de que plataforma é o link, ou `null` se não for TikTok nem Instagram. */
export function origemDoLink(texto: string): Exclude<OrigemTendencia, "upload"> | null {
  let url: URL;
  try {
    url = new URL(texto.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (HOSTS_TIKTOK.includes(host)) return "tiktok";
  if (HOSTS_INSTAGRAM.includes(host)) return "instagram";
  return null;
}
