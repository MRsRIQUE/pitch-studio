import { afterEach, describe, expect, it, vi } from "vitest";
import { pollKieOnce } from "@/lib/jobs/kie";
import { isPrivateHost } from "@/lib/media";
import { decodeFields, encodeFields } from "@/lib/firestore/values";
import { creditsFor } from "@/lib/jobs/charge";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(body: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

describe("pollKieOnce", () => {
  it("lê o resultado da API de jobs", async () => {
    stubFetch({ code: 200, data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["https://a/1.png"] }) } });
    await expect(pollKieOnce("t", "k", "jobs")).resolves.toEqual({ state: "done", urls: ["https://a/1.png"] });
  });

  it("lê o resultado do Veo pelo successFlag", async () => {
    stubFetch({ code: 200, data: { successFlag: 1, response: { resultUrls: ["https://a/v.mp4"] } } });
    await expect(pollKieOnce("t", "k", "veo")).resolves.toEqual({ state: "done", urls: ["https://a/v.mp4"] });
    stubFetch({ code: 200, data: { successFlag: 0 } });
    await expect(pollKieOnce("t", "k", "veo")).resolves.toEqual({ state: "pending" });
    stubFetch({ code: 200, data: { successFlag: 2, errorMessage: "bloqueado" } });
    await expect(pollKieOnce("t", "k", "veo")).resolves.toEqual({ state: "error", error: "bloqueado" });
  });

  it("erro de rede ou 5xx é transitório", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNRESET"); }));
    await expect(pollKieOnce("t", "k", "jobs")).resolves.toMatchObject({ state: "transient" });
    stubFetch({}, 502);
    await expect(pollKieOnce("t", "k", "jobs")).resolves.toMatchObject({ state: "transient" });
  });
});

describe("isPrivateHost", () => {
  it("bloqueia rede interna e metadados", () => {
    for (const h of ["localhost", "127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.0.10", "169.254.169.254", "metadata.google.internal", "[::1]", "fd00::1", "100.64.0.1"]) {
      expect(isPrivateHost(h), h).toBe(true);
    }
  });

  it("libera domínio público, inclusive os que começam com fc/fd", () => {
    for (const h of ["cdn.kie.ai", "fcbarcelona.com", "fd.example.org", "172.32.0.1", "8.8.8.8"]) {
      expect(isPrivateHost(h), h).toBe(false);
    }
  });
});

describe("valores do Firestore", () => {
  it("ida e volta preserva tipos e descarta undefined", () => {
    const data = { a: "x", n: 3, f: 1.5, b: true, z: null, arr: [1, "y"], m: { k: 2 }, u: undefined };
    const encoded = encodeFields(data);
    expect(encoded.n).toEqual({ integerValue: "3" });
    expect(encoded.f).toEqual({ doubleValue: 1.5 });
    expect("u" in encoded).toBe(false);
    expect(decodeFields(encoded)).toEqual({ a: "x", n: 3, f: 1.5, b: true, z: null, arr: [1, "y"], m: { k: 2 } });
  });
});

describe("creditsFor", () => {
  it("usa o teto da tabela arredondado para cima", () => {
    // Nano Banana 2 em 1K: 8 créditos por imagem.
    expect(creditsFor({ model: "nano-banana-2", kind: "image", quality: "1k", resolution: "1k", references: 0 })).toBe(8);
  });

  it("modelo sem preço na tabela não tem custo (a rota recusa)", () => {
    expect(creditsFor({ model: "modelo-inexistente", kind: "image" })).toBeNull();
  });
});
