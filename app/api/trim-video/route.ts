/**
 * POST /api/trim-video
 * Body: { videoUrl: string, startTime: number, endTime: number }
 * Baixa o vídeo, corta com ffmpeg e guarda o resultado na mídia do Studio.
 * Returns: { cdnUrl: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/currentUser";
import { FFMPEG } from "@/lib/ffmpegBin";
import { readStoredBytes } from "@/lib/media";
import { uploadBuffer } from "@/lib/storage";
import { writeFile, readFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const maxDuration = 120;

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  let inputPath: string | null  = null;
  let outputPath: string | null = null;

  try {
    const { videoUrl, startTime, endTime } = await req.json();

    if (!videoUrl || startTime === undefined || endTime === undefined) {
      return NextResponse.json({ error: "videoUrl, startTime and endTime are required" }, { status: 400 });
    }
    if (endTime <= startTime) {
      return NextResponse.json({ error: "endTime must be greater than startTime" }, { status: 400 });
    }

    // Download the video
    let videoBuffer: Buffer;
    try {
      videoBuffer = await readStoredBytes(String(videoUrl));
    } catch (e) {
      return NextResponse.json({ error: `Failed to fetch video: ${(e as Error).message}` }, { status: 400 });
    }
    const contentType = "video/mp4";

    // Write to temp files
    const tmpDir  = await mkdtemp(join(tmpdir(), "trim-"));
    inputPath  = join(tmpDir, "input.mp4");
    outputPath = join(tmpDir, "output.mp4");
    await writeFile(inputPath, videoBuffer);

    // Trim with ffmpeg: -ss before -i = fast seek; -t = duration; -c copy = no re-encode
    await execFileAsync(FFMPEG, [
      "-ss", String(startTime),
      "-i",  inputPath,
      "-t",  String(endTime - startTime),
      "-c",  "copy",
      "-avoid_negative_ts", "1",
      "-y",
      outputPath,
    ]);

    const outputBuffer = await readFile(outputPath);
    const cdnUrl = await uploadBuffer(outputBuffer, contentType.startsWith("video/") ? contentType : "video/mp4", "references");

    return NextResponse.json({ cdnUrl });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[trim-video] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    // Cleanup temp files
    await Promise.all([
      inputPath  ? unlink(inputPath).catch(() => {})  : Promise.resolve(),
      outputPath ? unlink(outputPath).catch(() => {}) : Promise.resolve(),
    ]);
  }
}
