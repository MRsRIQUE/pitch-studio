/**
 * GET /api/cron/jobs — Vercel Cron (vercel.json), a cada minuto.
 *
 * Avança os jobs pendentes que ninguém está olhando: quem gerou e fechou a
 * aba ainda recebe o resultado na galeria, e o crédito é confirmado ou
 * estornado. A Vercel manda `Authorization: Bearer <CRON_SECRET>`.
 */
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { data } from "@/lib/data";
import { advanceJob } from "@/lib/jobs/lifecycle";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH = 50;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim() || "";
  if (secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") || "", "utf8");
  const wanted = Buffer.from(`Bearer ${secret}`, "utf8");
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const pending = await (await data()).listPendingJobs(BATCH);
  const result = { checked: pending.length, done: 0, error: 0, pending: 0, failed: 0 };
  // Em série: são consultas curtas e não vale disputar o limite da kie.ai.
  for (const job of pending) {
    try {
      const next = await advanceJob(job.taskId, { force: true });
      if (next?.status === "done") result.done++;
      else if (next?.status === "error") result.error++;
      else result.pending++;
    } catch (e) {
      result.failed++;
      console.error(`[cron/jobs] ${job.taskId}:`, (e as Error).message);
    }
  }
  return NextResponse.json(result);
}
