/**
 * GET /api/job-status?taskId= — estado do job, avançando-o um passo.
 *
 * Cada leitura pode consultar o provedor (no máximo a cada POLL_GAP_MS por
 * job, ver `lib/jobs/lifecycle.ts`). Job de outro usuário é `not_found`.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/auth/currentUser";
import { data } from "@/lib/data";
import { advanceJob, viewOf } from "@/lib/jobs/lifecycle";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId is required" }, { status: 400 });

  const existing = await (await data()).getJob(taskId);
  if (!existing || existing.uid !== user.uid) return NextResponse.json({ status: "not_found" }, { status: 404 });

  const job = (await advanceJob(taskId)) ?? existing;
  return NextResponse.json(viewOf(job));
}
