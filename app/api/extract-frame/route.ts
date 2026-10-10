/**
 * POST /api/extract-frame
 * Body: { videoUrl: string, timeSeconds?: number, lastFrame?: boolean }
 * Extrai um quadro JPEG de um vídeo com ffmpeg e guarda na mídia do Studio.
 * Returns: { cdnUrl: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/currentUser";
import { FFMPEG, FFPROBE } from "@/lib/ffmpegBin";
import { readStoredBytes } from "@/lib/media";
import { uploadBuffer } from "@/lib/storage";
import { writeFile, readFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const maxDuration = 60;

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  let inputPath: string | null  = null;
  let outputPath: string | null = null;

  try {
    const { videoUrl, timeSeconds = 0, lastFrame = false } = await req.json();

    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
    }

    let videoBuffer: Buffer;
    try {
      videoBuffer = await readStoredBytes(String(videoUrl));
    } catch (e) {
      return NextResponse.json({ error: `Failed to fetch video: ${(e as Error).message}` }, { status: 400 });
    }

    const tmpDir  = await mkdtemp(join(tmpdir(), "frame-"));
    inputPath  = join(tmpDir, "input.mp4");
    outputPath = join(tmpDir, "frame.jpg");
    await writeFile(inputPath, videoBuffer);

    const { stdout: probeOut } = await execFileAsync(FFPROBE, [
      "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", inputPath,
    ]);
    const dur = parseFloat(probeOut.trim());
    const safeDur = isNaN(dur) ? undefined : dur;

    let ffmpegArgs: string[];
    if (lastFrame) {
      const seekTime = safeDur !== undefined ? Math.max(0, safeDur - 0.1) : 0;
      ffmpegArgs = ["-ss", String(seekTime), "-i", inputPath, "-frames:v", "1", "-q:v", "2", "-y", outputPath];
    } else {
      // Clamp to 0.1s before the video end so ffmpeg always finds a frame to encode.
      const clampedTime = safeDur !== undefined
        ? Math.min(Math.max(0, timeSeconds), Math.max(0, safeDur - 0.1))
        : Math.max(0, timeSeconds);
      ffmpegArgs = ["-ss", String(clampedTime), "-i", inputPath, "-frames:v", "1", "-q:v", "2", "-y", outputPath];
    }

    await execFileAsync(FFMPEG, ffmpegArgs);

    const frameBuffer = await readFile(outputPath);
    const cdnUrl = await uploadBuffer(frameBuffer, "image/jpeg", "references");

    return NextResponse.json({ cdnUrl });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[extract-frame] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await Promise.all([
      inputPath  ? unlink(inputPath).catch(() => {})  : Promise.resolve(),
      outputPath ? unlink(outputPath).catch(() => {}) : Promise.resolve(),
    ]);
  }
}
