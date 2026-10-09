import { NextRequest } from "next/server";
import { jobStore, type JobResult } from "@/lib/jobStore";
import { jobEvents } from "@/lib/jobEvents";
import { resumeKieJob } from "@/lib/kieJobPoller";
import { resumeHiggsfieldJob } from "@/lib/higgsfieldJobPoller";
import { GUEST_USER_ID } from "@/lib/guestMode";
import * as guestDb from "@/lib/guest/db";
import { inferGenerationErrorCode } from "@/lib/generationError";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
};

const TIMEOUT_MS = 30 * 60 * 1000;

function immediate(payload: JobResult): Response {
  return new Response(`data: ${JSON.stringify(payload)}\n\n`, { headers: SSE_HEADERS });
}

function recoverJob(taskId: string): JobResult | null {
  const gen = guestDb.recoverJob(taskId);
  if (!gen || gen.user_id !== GUEST_USER_ID) return null;
  if (gen?.status === "done") {
    return gen.video_url
      ? { status: "done", videoUrl: gen.video_url, userId: GUEST_USER_ID }
      : { status: "done", imageUrl: gen.image_url ?? undefined, imageUrls: gen.image_urls ?? undefined, userId: GUEST_USER_ID };
  }
  if (gen?.status === "error") {
    const error = gen.error_msg ?? "Generation failed";
    return { status: "error", error, errorCode: inferGenerationErrorCode(error), userId: GUEST_USER_ID };
  }
  if (gen.status === "pending") {
    return {
      status: "pending",
      type: "video",
      userId: GUEST_USER_ID,
      provider: gen.model?.startsWith("higgsfield-") ? "higgsfield" : "kie",
    };
  }
  return null;
}

function resumePending(taskId: string, result: Extract<JobResult, { status: "pending" }>): void {
  if (result.provider === "higgsfield") {
    resumeHiggsfieldJob(taskId, result.statusUrl, GUEST_USER_ID);
  } else if (!taskId.startsWith("azure-")) {
    resumeKieJob(taskId, result.type === "video" ? "video" : "image");
  }
}

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) return new Response("taskId required", { status: 400 });

  // Already settled in jobStore — respond immediately, no stream needed
  const existing = jobStore.get(taskId);
  if (existing?.userId && existing.userId !== GUEST_USER_ID) {
    return immediate({ status: "error", error: "Job not found", userId: GUEST_USER_ID });
  }
  if (existing && existing.status !== "pending") {
    if (existing.status === "error" && !existing.errorCode) {
      const enriched = { ...existing, errorCode: inferGenerationErrorCode(existing.error) };
      jobStore.set(taskId, enriched);
      return immediate(enriched);
    }
    return immediate(existing);
  }

  if (!existing) {
    const recovered = recoverJob(taskId);
    if (recovered) {
      jobStore.set(taskId, recovered);
      if (recovered.status !== "pending") return immediate(recovered);
    }
    // No DB record either — truly not found
    if (!recovered) return immediate({ status: "error", error: "Job not found", userId: GUEST_USER_ID });
  }

  const pending = jobStore.get(taskId);
  if (!pending || pending.status !== "pending") return immediate({ status: "error", error: "Job not found" });
  resumePending(taskId, pending);

  // Job is pending — open an SSE stream and wait for the poller/callback to fire
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      let closed = false;

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearTimeout(timeout);
        controller.close();
      };

      const send = (payload: JobResult) => {
        if (closed) return;
        controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));
        close();
      };

      // Keepalive comment every 25 s (proxies drop idle SSE connections)
      const heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(enc.encode(": ping\n\n"));
      }, 25_000);

      // Hard cap — emit error if callback never arrives
      const timeout = setTimeout(() => {
        send({ status: "error", error: "Generation timed out" });
      }, TIMEOUT_MS);

      jobEvents.once(`job:${taskId}`, send);

      req.signal.addEventListener("abort", () => {
        jobEvents.off(`job:${taskId}`, send);
        close();
      });
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
