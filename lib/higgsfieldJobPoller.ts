import type { V2Response } from "@higgsfield/client/v2";
import { jobEvents } from "./jobEvents";
import { jobStore, type JobResult } from "./jobStore";
import { mirrorToR2 } from "./storage";
import * as guestDb from "./guest/db";

const API_ORIGIN = "https://api.higgsfield.ai";
const USER_AGENT = "pitch-studio/0.1.0";
const MAX_POLL_MS = 30 * 60 * 1000;
const active = new Set<string>();

type HiggsfieldStatus = Omit<V2Response, "status"> & {
  status: V2Response["status"] | "canceled";
  error?: string | { message?: string };
};

function safeStatusUrl(taskId: string, candidate?: string): string {
  const fallback = `${API_ORIGIN}/requests/${encodeURIComponent(taskId)}/status`;
  if (!candidate) return fallback;
  try {
    const url = new URL(candidate);
    if (url.origin === API_ORIGIN && url.protocol === "https:") return url.toString();
  } catch {
    // Fall back to the documented request-status URL.
  }
  return fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function settle(taskId: string, result: JobResult): void {
  jobStore.set(taskId, result);
  jobEvents.emit(`job:${taskId}`, result);
  if (result.status === "done") {
    guestDb.updateGeneration(taskId, { status: "done", video_url: result.videoUrl });
  } else if (result.status === "error") {
    guestDb.updateGeneration(taskId, { status: "error", error_msg: result.error });
  }
}

async function settleSuccess(taskId: string, sourceUrl: string, userId: string): Promise<void> {
  let videoUrl = sourceUrl;
  try {
    videoUrl = await mirrorToR2(sourceUrl, "videos");
  } catch (error) {
    console.error(`[higgsfield-poller] ${taskId} storage mirror failed:`, (error as Error).message);
  }
  settle(taskId, { status: "done", videoUrl, userId, provider: "higgsfield" });
}

function terminalMessage(response: HiggsfieldStatus): string {
  if (typeof response.error === "string") return response.error;
  return response.error?.message ||
    (response.status === "nsfw" ? "A Higgsfield recusou a geração pela política de segurança (NSFW)." :
      response.status === "canceled" ? "Higgsfield generation was canceled." :
      "Higgsfield generation failed.");
}

async function handleResponse(taskId: string, response: HiggsfieldStatus, userId: string): Promise<boolean> {
  if (response.status === "completed") {
    if (!response.video?.url) {
      settle(taskId, {
        status: "error",
        error: "Higgsfield completed the generation without a video URL.",
        userId,
        provider: "higgsfield",
      });
    } else {
      await settleSuccess(taskId, response.video.url, userId);
    }
    return true;
  }
  if (["failed", "nsfw", "canceled"].includes(response.status)) {
    settle(taskId, {
      status: "error",
      error: terminalMessage(response),
      errorCode: response.status,
      userId,
      provider: "higgsfield",
    });
    return true;
  }
  return false;
}

async function loop(
  taskId: string,
  credentials: string,
  statusUrl: string,
  userId: string,
  initial?: V2Response,
): Promise<void> {
  if (initial && await handleResponse(taskId, initial as HiggsfieldStatus, userId)) return;

  const deadline = Date.now() + MAX_POLL_MS;
  let delayMs = 2_000;
  while (Date.now() < deadline) {
    await sleep(delayMs + Math.floor(Math.random() * 300));

    try {
      const response = await fetch(statusUrl, {
        headers: {
          Authorization: `Key ${credentials}`,
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 404) {
        settle(taskId, {
          status: "error",
          error: response.status === 401
            ? "Higgsfield credentials are no longer valid."
            : "Higgsfield could not find this generation.",
          userId,
          provider: "higgsfield",
        });
        return;
      }
      if (response.status === 429 || response.status >= 500) {
        delayMs = Math.min(10_000, Math.round(delayMs * 1.5));
        continue;
      }
      if (!response.ok) {
        settle(taskId, {
          status: "error",
          error: `Higgsfield status check failed (HTTP ${response.status}).`,
          userId,
          provider: "higgsfield",
        });
        return;
      }

      const data = await response.json() as HiggsfieldStatus;
      if (await handleResponse(taskId, data, userId)) return;
    } catch (error) {
      console.warn(`[higgsfield-poller] ${taskId} transient status error:`, (error as Error).message);
    }
    delayMs = Math.min(10_000, Math.round(delayMs * 1.5));
  }

  settle(taskId, {
    status: "error",
    error: "Higgsfield generation exceeded the 30-minute polling timeout. Check the Higgsfield console before submitting again.",
    userId,
    provider: "higgsfield",
  });
}

export function pollHiggsfieldJob(
  taskId: string,
  credentials: string,
  statusUrl: string | undefined,
  userId: string,
  initial?: V2Response,
): void {
  if (!taskId || active.has(taskId)) return;
  active.add(taskId);
  const safeUrl = safeStatusUrl(taskId, statusUrl);
  void loop(taskId, credentials, safeUrl, userId, initial)
    .catch((error) => {
      console.error(`[higgsfield-poller] ${taskId} crashed:`, error);
      settle(taskId, {
        status: "error",
        error: "Higgsfield generation polling failed.",
        userId,
        provider: "higgsfield",
      });
    })
    .finally(() => active.delete(taskId));
}

export function resumeHiggsfieldJob(taskId: string, statusUrl: string | undefined, userId: string): void {
  if (active.has(taskId)) return;
  const credentials = guestDb.getHiggsfieldCredentials();
  if (!credentials) return;
  pollHiggsfieldJob(taskId, credentials, statusUrl, userId);
}
