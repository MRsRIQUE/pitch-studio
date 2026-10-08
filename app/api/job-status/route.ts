import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/lib/jobStore";
import { resumeKieJob } from "@/lib/kieJobPoller";
import { resumeHiggsfieldJob } from "@/lib/higgsfieldJobPoller";
import { GUEST_USER_ID } from "@/lib/guestMode";
import * as guestDb from "@/lib/guest/db";
import { inferGenerationErrorCode } from "@/lib/generationError";

function recoverJob(taskId: string): "done" | "error" | "pending" | "not_found" {
  const gen = guestDb.recoverJob(taskId);
  if (!gen) return "not_found";
  if (gen.user_id !== GUEST_USER_ID) return "not_found";
  if (gen.status === "done") {
    const result = gen.video_url
      ? { status: "done" as const, videoUrl: gen.video_url, userId: GUEST_USER_ID }
      : { status: "done" as const, imageUrl: gen.image_url ?? undefined, imageUrls: gen.image_urls ?? undefined, userId: GUEST_USER_ID };
    jobStore.set(taskId, result);
    return "done";
  }
  if (gen.status === "error") {
    const error = gen.error_msg ?? "Generation failed";
    jobStore.set(taskId, { status: "error", error, errorCode: inferGenerationErrorCode(error), userId: GUEST_USER_ID });
    return "error";
  }
  const provider = gen.model?.startsWith("higgsfield-") ? "higgsfield" : "kie";
  jobStore.set(taskId, { status: "pending", type: "video", userId: GUEST_USER_ID, provider });
  return "pending";
}

function resumePending(taskId: string): void {
  const result = jobStore.get(taskId);
  if (!result || result.status !== "pending") return;
  if (result.provider === "higgsfield") {
    resumeHiggsfieldJob(taskId, result.statusUrl, GUEST_USER_ID);
  } else if (!taskId.startsWith("azure-")) {
    resumeKieJob(taskId, result.type === "video" ? "video" : "image");
  }
}

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const result = jobStore.get(taskId);
  if (result?.userId && result.userId !== GUEST_USER_ID) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  // Task known to local store — return as-is, no kie.ai polling
  if (result) {
    // If a restart killed the background poller for a job that's still pending,
    // restart it so the result can still land.
    if (result.status === "pending") resumePending(taskId);
    if (result.status === "error" && !result.errorCode) {
      const enriched = { ...result, errorCode: inferGenerationErrorCode(result.error) };
      jobStore.set(taskId, enriched);
      return NextResponse.json(enriched);
    }
    return NextResponse.json(result);
  }

  // Task not in local store (server restarted / cold start).
  // Azure jobs have no DB record and can't be recovered.
  if (taskId.startsWith("azure-")) {
    return NextResponse.json({ status: "not_found" });
  }

  const recovered = recoverJob(taskId);

  if (recovered === "done" || recovered === "error") {
    return NextResponse.json(jobStore.get(taskId)!);
  }

  if (recovered === "pending") {
    resumePending(taskId);
    return NextResponse.json(jobStore.get(taskId)!);
  }

  return NextResponse.json({ status: "not_found" });
}
