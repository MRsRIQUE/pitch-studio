/**
 * Os binários do ffmpeg/ffprobe que o Studio usa.
 *
 * Na Vercel não há ffmpeg no sistema: vêm do `ffmpeg-static` (baixado para a
 * plataforma do build) e do `ffprobe-static` (que traz todas as plataformas —
 * o `next.config.ts` só empacota o de linux/x64). `FFMPEG_PATH`/`FFPROBE_PATH`
 * sobrescrevem; sem nada disso, cai no do PATH, como o app local fazia.
 */
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

export const FFMPEG: string = process.env.FFMPEG_PATH?.trim() || ffmpegStatic || "ffmpeg";
export const FFPROBE: string = process.env.FFPROBE_PATH?.trim() || ffprobeStatic?.path || "ffprobe";
