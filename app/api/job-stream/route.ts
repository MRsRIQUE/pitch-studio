/**
 * GET /api/job-stream?taskId= — SSE com o desfecho do job.
 *
 * Sem processo vivo não há evento para esperar: o próprio stream avança o job
 * a cada POLL_GAP_MS e manda o resultado quando ele encerra. Perto do limite
 * da função ele fecha sem resultado; o `EventSource` do navegador reconecta
 * sozinho e a espera continua de onde estava (o estado mora no banco).
 */
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/currentUser";
import { data } from "@/lib/data";
import { POLL_GAP_MS, advanceJob, viewOf, type JobView } from "@/lib/jobs/lifecycle";

export const runtime = "nodejs";
export const maxDuration = 300;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

/** Fecha antes do `maxDuration` para a reconexão ser limpa. */
const STREAM_BUDGET_MS = 280_000;

function immediate(payload: JobView): Response {
  return new Response(`data: ${JSON.stringify(payload)}\n\n`, { headers: SSE_HEADERS });
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return immediate({ status: "error", error: "Sua sessão expirou. Entre de novo." });
  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) return new Response("taskId required", { status: 400 });

  const existing = await (await data()).getJob(taskId);
  if (!existing || existing.uid !== user.uid) return immediate({ status: "error", error: "Job not found" });

  const first = (await advanceJob(taskId)) ?? existing;
  if (first.status !== "pending") return immediate(viewOf(first));

  const started = Date.now();
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let closed = false;
      req.signal.addEventListener("abort", () => {
        closed = true;
      });
      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };
      // `retry` curto: ao fechar por tempo, o navegador volta logo.
      controller.enqueue(enc.encode("retry: 1000\n\n"));
      while (!closed && Date.now() - started < STREAM_BUDGET_MS) {
        await new Promise((r) => setTimeout(r, POLL_GAP_MS));
        if (closed) break;
        try {
          const job = await advanceJob(taskId);
          if (job && job.status !== "pending") {
            controller.enqueue(enc.encode(`data: ${JSON.stringify(viewOf(job))}\n\n`));
            close();
            return;
          }
          controller.enqueue(enc.encode(": ping\n\n"));
        } catch (e) {
          console.warn(`[job-stream] ${taskId}:`, (e as Error).message);
        }
      }
      close();
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}
