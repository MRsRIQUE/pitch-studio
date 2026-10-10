import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeSession, devSession, encodeSession, newSession } from "@/lib/auth/session";

const KEY = "k".repeat(40);
const NOW = Date.parse("2026-10-08T12:00:00.000Z");

afterEach(() => vi.unstubAllEnvs());

describe("cookie de sessão", () => {
  it("ida e volta com a mesma chave", () => {
    const cookie = encodeSession(newSession("uid123", "a@b.com", NOW), KEY);
    expect(decodeSession(cookie, NOW, KEY)).toEqual({
      uid: "uid123",
      email: "a@b.com",
      exp: Math.floor(NOW / 1000) + 7 * 24 * 60 * 60,
    });
  });

  it("assinatura de outra chave não vale", () => {
    const cookie = encodeSession(newSession("uid123", null, NOW), KEY);
    expect(decodeSession(cookie, NOW, "x".repeat(40))).toBeNull();
  });

  it("payload adulterado não vale", () => {
    const [, sig] = encodeSession(newSession("uid123", null, NOW), KEY).split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "outro", email: null, exp: 9e9 })).toString("base64url");
    expect(decodeSession(`${forged}.${sig}`, NOW, KEY)).toBeNull();
  });

  it("vencido não vale", () => {
    const cookie = encodeSession({ uid: "uid123", email: null, exp: Math.floor(NOW / 1000) - 1 }, KEY);
    expect(decodeSession(cookie, NOW, KEY)).toBeNull();
  });

  it("sem chave configurada nada vale e nada é emitido", () => {
    expect(decodeSession("a.b", NOW, null)).toBeNull();
    expect(() => encodeSession(newSession("uid123", null, NOW), null)).toThrow();
  });

  it("formato quebrado não lança", () => {
    for (const bad of ["", "abc", "a.b.c", ".", "x.y"]) expect(decodeSession(bad, NOW, KEY)).toBeNull();
  });
});

describe("sessão de desenvolvimento", () => {
  it("vale fora da Vercel", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("STUDIO_DEV_USER", "dev-user");
    expect(devSession()?.uid).toBe("dev-user");
  });

  it("é ignorada na Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("STUDIO_DEV_USER", "dev-user");
    expect(devSession()).toBeNull();
  });
});
