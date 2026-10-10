import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acceptCreditsTerms, getStudioMe, reserveCredits } from "@/lib/saysell/client";

/** Contrato com o saysell-web para a cláusula de créditos do Studio. */
const CLAUSE = { version: "2026-10-09", text: "Créditos do SaySell Studio…", sha256: "h".repeat(64) };
const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  vi.stubEnv("SAYSELL_API_URL", "https://saysell.test");
  vi.stubEnv("STUDIO_SERVICE_KEY", "k".repeat(40));
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("cláusula de créditos", () => {
  it("me traz a cláusula pendente com texto, versão e hash", async () => {
    reply(200, { ok: true, level: "selected", balance: {}, creditsTerms: { accepted: false, ...CLAUSE } });
    expect((await getStudioMe("uid-1")).creditsTerms).toEqual({ accepted: false, ...CLAUSE });
  });

  it("saysell-web sem o campo não abre a tela de aceite", async () => {
    reply(200, { ok: true, level: "selected", balance: {} });
    expect((await getStudioMe("uid-1")).creditsTerms).toBeNull();
  });

  it("aceite manda versão e hash mostrados; 409 vira texto desatualizado", async () => {
    reply(200, { ok: true, created: true });
    expect(await acceptCreditsTerms("uid-1", { version: CLAUSE.version, sha256: CLAUSE.sha256 })).toBe("ok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://saysell.test/api/studio/terms");
    expect(JSON.parse(init.body)).toEqual({ accepted: true, version: CLAUSE.version, sha256: CLAUSE.sha256 });
    reply(409, { ok: false, reason: "terms_stale" });
    expect(await acceptCreditsTerms("uid-1", { version: "x", sha256: "y" })).toBe("stale");
  });

  it("reserva recusada por falta de aceite tem motivo próprio", async () => {
    reply(403, { ok: false, reason: "terms_required" });
    const result = await reserveCredits("uid-1", {
      jobId: "job-12345678",
      credits: 8,
      model: "nano-banana-2",
      kind: "image",
      resolution: "1k",
    });
    expect(result).toEqual({ ok: false, reason: "terms_required" });
  });
});
