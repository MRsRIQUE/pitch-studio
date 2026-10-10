import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioJob } from "@/lib/data/types";

/** Banco de jobs em memória com a mesma trava do real (`updateJobIf`). */
const store = vi.hoisted(() => {
  const jobs = new Map<string, Record<string, unknown>>();
  const generations: Array<{ uid: string; taskId: string; updates: Record<string, unknown> }> = [];
  return {
    jobs,
    generations,
    api: {
      getJob: vi.fn(async (taskId: string) => (jobs.has(taskId) ? structuredClone(jobs.get(taskId)) : null)),
      putJob: vi.fn(async (job: Record<string, unknown>) => void jobs.set(String(job.taskId), structuredClone(job))),
      updateJobIf: vi.fn(async (taskId: string, expect: string, patch: Record<string, unknown>) => {
        const job = jobs.get(taskId);
        if (!job || job.status !== expect) return false;
        jobs.set(taskId, { ...job, ...patch, updatedAt: Date.now() });
        return true;
      }),
      updateGeneration: vi.fn(async (uid: string, taskId: string, updates: Record<string, unknown>) => {
        generations.push({ uid, taskId, updates });
      }),
    },
  };
});
const credits = vi.hoisted(() => ({ settleCredits: vi.fn(async () => undefined) }));
const kie = vi.hoisted(() => ({ pollKieOnce: vi.fn() }));
const media = vi.hoisted(() => ({
  mirrorToStorage: vi.fn(async (url: string) => `https://x.public.blob.vercel-storage.com/${url.split("/").pop()}`),
  uploadBuffer: vi.fn(async () => "https://x.public.blob.vercel-storage.com/mock.png"),
}));

vi.mock("@/lib/data", () => ({ data: async () => store.api }));
vi.mock("@/lib/saysell/client", () => credits);
vi.mock("@/lib/jobs/kie", () => kie);
vi.mock("@/lib/media", () => media);
vi.mock("@/lib/getKieToken", () => ({ getKieToken: async () => "kie-key" }));
vi.mock("@/lib/mockProvider", () => ({
  MOCK_LATENCY_MS: 2500,
  renderMockResult: async () => ({ buffer: Buffer.from("png"), contentType: "image/png", folder: "images" }),
}));

import { JOB_TIMEOUT_MS, advanceJob, startJob, viewOf } from "@/lib/jobs/lifecycle";

const UID = "uid-1";

async function pendingKieJob(taskId = "task-1", kind: "image" | "video" = "image") {
  return startJob({ uid: UID, taskId, kind, provider: "kie", kieApi: "jobs", model: "nano-banana-2", creditJobId: `gen_${taskId}` });
}

beforeEach(() => {
  store.jobs.clear();
  store.generations.length = 0;
  vi.clearAllMocks();
});

describe("advanceJob", () => {
  it("sucesso espelha a mídia, grava a geração e confirma o crédito uma vez", async () => {
    await pendingKieJob();
    kie.pollKieOnce.mockResolvedValue({ state: "done", urls: ["https://tempfile.aiquickdraw.com/a.png"] });

    const job = await advanceJob("task-1");

    expect(job?.status).toBe("done");
    expect(viewOf(job as StudioJob)).toEqual({
      status: "done",
      imageUrl: "https://x.public.blob.vercel-storage.com/a.png",
      imageUrls: ["https://x.public.blob.vercel-storage.com/a.png"],
    });
    expect(store.generations).toEqual([
      {
        uid: UID,
        taskId: "task-1",
        updates: {
          status: "done",
          image_url: "https://x.public.blob.vercel-storage.com/a.png",
          image_urls: ["https://x.public.blob.vercel-storage.com/a.png"],
        },
      },
    ]);
    expect(credits.settleCredits).toHaveBeenCalledExactlyOnceWith(UID, "gen_task-1", "committed");
  });

  it("falha no provedor estorna o crédito", async () => {
    await pendingKieJob();
    kie.pollKieOnce.mockResolvedValue({ state: "error", error: "content policy" });

    const job = await advanceJob("task-1");

    expect(job?.status).toBe("error");
    expect(credits.settleCredits).toHaveBeenCalledExactlyOnceWith(UID, "gen_task-1", "refunded");
  });

  it("job ainda gerando não encerra e não consulta de novo antes do intervalo", async () => {
    await pendingKieJob();
    kie.pollKieOnce.mockResolvedValue({ state: "pending" });

    await advanceJob("task-1");
    await advanceJob("task-1");

    expect(kie.pollKieOnce).toHaveBeenCalledTimes(1);
    expect(store.jobs.get("task-1")?.status).toBe("pending");
    expect(credits.settleCredits).not.toHaveBeenCalled();
  });

  it("dois leitores ao mesmo tempo encerram uma vez só", async () => {
    await pendingKieJob();
    kie.pollKieOnce.mockResolvedValue({ state: "done", urls: ["https://tempfile.aiquickdraw.com/a.png"] });

    await Promise.all([advanceJob("task-1", { force: true }), advanceJob("task-1", { force: true })]);

    expect(credits.settleCredits).toHaveBeenCalledTimes(1);
    expect(store.generations).toHaveLength(1);
  });

  it("job pendente além do tempo máximo vira erro com estorno", async () => {
    const job = await pendingKieJob();
    store.jobs.set("task-1", { ...job, createdAt: Date.now() - JOB_TIMEOUT_MS - 1 });

    const next = await advanceJob("task-1");

    expect(next?.status).toBe("error");
    expect(kie.pollKieOnce).not.toHaveBeenCalled();
    expect(credits.settleCredits).toHaveBeenCalledExactlyOnceWith(UID, "gen_task-1", "refunded");
  });

  it("falha transitória mantém pendente", async () => {
    await pendingKieJob();
    kie.pollKieOnce.mockResolvedValue({ state: "transient", error: "ECONNRESET" });

    const job = await advanceJob("task-1");

    expect(job?.status).toBe("pending");
    expect(credits.settleCredits).not.toHaveBeenCalled();
  });

  it("Veo consulta a API do Veo", async () => {
    await startJob({ uid: UID, taskId: "veo-1", kind: "video", provider: "kie", kieApi: "veo", model: "veo3_fast", creditJobId: "gen_veo" });
    kie.pollKieOnce.mockResolvedValue({ state: "pending" });

    await advanceJob("veo-1");

    expect(kie.pollKieOnce).toHaveBeenCalledWith("veo-1", "kie-key", "veo");
  });

  it("mock só encerra depois do instante combinado e não cobra", async () => {
    await startJob({
      uid: UID,
      taskId: "mock-1",
      kind: "image",
      provider: "mock",
      model: "nano-banana-2",
      creditJobId: null,
      mockInput: { prompt: "gato", aspectRatio: "1:1" },
    });
    expect((await advanceJob("mock-1"))?.status).toBe("pending");

    store.jobs.set("mock-1", { ...store.jobs.get("mock-1"), mockReadyAt: Date.now() - 1 });
    const done = await advanceJob("mock-1");

    expect(done?.status).toBe("done");
    expect(credits.settleCredits).not.toHaveBeenCalled();
  });
});
