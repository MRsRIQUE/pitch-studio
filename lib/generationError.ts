export function isSafetyBlocked(message?: string, code?: string): boolean {
  if (code?.toLowerCase() === "nsfw") return true;
  const normalized = message?.toLowerCase() ?? "";
  return [
    "nsfw",
    "moderation_blocked",
    "flagged as sensitive",
    "safety policy",
    "política de segurança",
    "moderation",
  ].some((marker) => normalized.includes(marker));
}

export function inferGenerationErrorCode(message?: string): string | undefined {
  return isSafetyBlocked(message) ? "nsfw" : undefined;
}
