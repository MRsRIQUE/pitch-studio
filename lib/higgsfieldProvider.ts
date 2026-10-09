import {
  APIError,
  AuthenticationError,
  BadInputError,
  CredentialsMissedError,
  NotEnoughCreditsError,
  TimeoutError,
  ValidationError,
  createHiggsfieldClient,
  type V2Response,
} from "@higgsfield/client/v2";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { MEDIA_DIR } from "./guest/paths";

export const HIGGSFIELD_SEEDANCE_2_ENDPOINT =
  "bytedance/seedance-2.0/text-to-video" as const;
export const HIGGSFIELD_GENJUTSU_MOTION_ENDPOINT =
  "higgsfield/genjutsu/motion-transfer/v1.0" as const;
export const HIGGSFIELD_GENJUTSU_OBJECT_ENDPOINT =
  "higgsfield/genjutsu/object-swap/v1.0" as const;

export type HiggsfieldEndpoint =
  | typeof HIGGSFIELD_SEEDANCE_2_ENDPOINT
  | typeof HIGGSFIELD_GENJUTSU_MOTION_ENDPOINT
  | typeof HIGGSFIELD_GENJUTSU_OBJECT_ENDPOINT;

export interface HiggsfieldTextToVideoInput {
  prompt: string;
  resolution: "480p" | "720p" | "1080p" | "4k";
  generate_audio: boolean;
  duration: number;
  aspect_ratio: "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9";
}

export interface HiggsfieldGenjutsuInput {
  prompt: string;
  video_url: string;
  image_urls: string[];
  resolution: "480p" | "720p";
}

/**
 * The POST is intentionally attempted once. Higgsfield does not currently
 * expose idempotency keys, so an automatic retry after a network timeout could
 * create and charge for a duplicate generation.
 */
export async function submitHiggsfieldGeneration(
  credentials: string,
  endpoint: HiggsfieldEndpoint,
  input: HiggsfieldTextToVideoInput | HiggsfieldGenjutsuInput,
): Promise<V2Response> {
  const client = createHiggsfieldClient({
    credentials,
    timeout: 30_000,
    maxRetries: 0,
  });

  return client.subscribe(endpoint, {
    input,
    withPolling: false,
  });
}

export function submitHiggsfieldTextToVideo(
  credentials: string,
  input: HiggsfieldTextToVideoInput,
): Promise<V2Response> {
  return submitHiggsfieldGeneration(credentials, HIGGSFIELD_SEEDANCE_2_ENDPOINT, input);
}

const APP_USER_AGENT = "pitch-studio/0.1.0";
const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
};

function splitCredentials(credentials: string): { apiKey: string; apiSecret: string } {
  const separator = credentials.indexOf(":");
  if (separator <= 0 || separator === credentials.length - 1) {
    throw new HiggsfieldSubmissionError(
      "Higgsfield credentials are malformed. Configure the Key ID and Key Secret in Settings.",
      401,
      false,
    );
  }
  return {
    apiKey: credentials.slice(0, separator),
    apiSecret: credentials.slice(separator + 1),
  };
}

function isPublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return ![
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "::1",
    ].includes(host) && !/^10\./.test(host) && !/^192\.168\./.test(host) && !/^172\.(1[6-9]|2\d|3[01])\./.test(host);
  } catch {
    return false;
  }
}

function localGeneratedPath(value: string): string | null {
  let pathname = value;
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (!parsed.pathname.startsWith("/generated/")) return null;
      pathname = parsed.pathname;
    } catch {
      return null;
    }
  }
  if (!pathname.startsWith("/generated/")) return null;
  const root = resolve(MEDIA_DIR);
  const filePath = resolve(root, decodeURIComponent(pathname.slice("/generated/".length)));
  if (!filePath.startsWith(`${root}${sep}`)) {
    throw new HiggsfieldSubmissionError("Invalid local media path.", 400, false);
  }
  return filePath;
}

async function readUpload(value: string): Promise<{ bytes: Buffer; contentType: string }> {
  if (value.startsWith("data:")) {
    const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(value);
    if (!match) throw new HiggsfieldSubmissionError("Invalid media data URL.", 400, false);
    return { bytes: Buffer.from(match[2], "base64"), contentType: match[1] };
  }

  const path = localGeneratedPath(value);
  if (!path) {
    throw new HiggsfieldSubmissionError(
      "Higgsfield needs a public media URL or a file from the local generated library.",
      400,
      false,
    );
  }
  const contentType = MIME_BY_EXTENSION[extname(path).toLowerCase()];
  if (!contentType) throw new HiggsfieldSubmissionError("Unsupported Higgsfield media file type.", 400, false);
  return { bytes: await readFile(/*turbopackIgnore: true*/ path), contentType };
}

const uploadCache = new Map<string, Promise<string>>();

interface HiggsfieldUploadSlot {
  upload_url?: unknown;
  public_url?: unknown;
  upload_headers?: unknown;
}

function uploadErrorMessage(status: number, detail: unknown, correlationId: string | null): string {
  const suffix = correlationId ? ` Correlation ID: ${correlationId}.` : "";
  if (status === 401) return `Invalid Higgsfield credentials.${suffix}`;
  if (status === 403) return `The Higgsfield account does not have enough credits or upload access.${suffix}`;
  const message = typeof detail === "string" ? detail : `HTTP ${status}`;
  return `Higgsfield could not create a media upload URL: ${message}.${suffix}`;
}

async function uploadToHiggsfield(
  bytes: Buffer,
  contentType: string,
  credentials: string,
): Promise<string> {
  let slotResponse: Response;
  try {
    slotResponse = await fetch("https://api.higgsfield.ai/files/generate-upload-url", {
      method: "POST",
      headers: {
        Authorization: `Key ${credentials}`,
        "Content-Type": "application/json",
        "User-Agent": APP_USER_AGENT,
      },
      body: JSON.stringify({ content_type: contentType }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new HiggsfieldSubmissionError(
      `Higgsfield media upload initialization failed: ${error instanceof Error ? error.message : "network error"}`,
      502,
      false,
    );
  }

  const correlationId = slotResponse.headers.get("x-correlation-id");
  const slot = await slotResponse.json().catch(() => ({})) as HiggsfieldUploadSlot & { detail?: unknown };
  if (!slotResponse.ok) {
    throw new HiggsfieldSubmissionError(
      uploadErrorMessage(slotResponse.status, slot.detail, correlationId),
      slotResponse.status === 403 ? 402 : slotResponse.status,
      false,
    );
  }
  if (typeof slot.upload_url !== "string" || typeof slot.public_url !== "string") {
    throw new HiggsfieldSubmissionError("Higgsfield returned an invalid media upload response.", 502, false);
  }

  let uploadUrl: URL;
  let publicUrl: URL;
  try {
    uploadUrl = new URL(slot.upload_url);
    publicUrl = new URL(slot.public_url);
  } catch {
    throw new HiggsfieldSubmissionError("Higgsfield returned an invalid media upload URL.", 502, false);
  }
  if (uploadUrl.protocol !== "https:" || publicUrl.protocol !== "https:") {
    throw new HiggsfieldSubmissionError("Higgsfield returned an unsafe media upload URL.", 502, false);
  }

  const returnedHeaders = slot.upload_headers && typeof slot.upload_headers === "object"
    ? Object.entries(slot.upload_headers as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    : [];
  const uploadHeaders = new Headers(returnedHeaders);
  if (!uploadHeaders.has("Content-Type")) uploadHeaders.set("Content-Type", contentType);

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: uploadHeaders,
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    throw new HiggsfieldSubmissionError(
      `The file could not be sent to Higgsfield storage: ${error instanceof Error ? error.message : "network error"}`,
      502,
      false,
    );
  }
  if (!uploadResponse.ok) {
    throw new HiggsfieldSubmissionError(
      `Higgsfield storage rejected the media upload (HTTP ${uploadResponse.status}).`,
      502,
      false,
    );
  }
  return publicUrl.toString();
}

/** Upload local Workflow media using the documented presigned-URL lifecycle. */
export async function ensureHiggsfieldReachableMedia(value: string, credentials: string): Promise<string> {
  if (isPublicUrl(value)) return value;
  const cacheKey = `${credentials.slice(0, credentials.indexOf(":"))}:${value}`;
  let upload = uploadCache.get(cacheKey);
  if (!upload) {
    upload = (async () => {
      splitCredentials(credentials);
      const { bytes, contentType } = await readUpload(value);
      return uploadToHiggsfield(bytes, contentType, credentials);
    })();
    uploadCache.set(cacheKey, upload);
    upload.catch(() => uploadCache.delete(cacheKey));
  }
  return upload;
}

export class HiggsfieldSubmissionError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly ambiguous: boolean,
  ) {
    super(message);
  }
}

export function normalizeHiggsfieldSubmissionError(error: unknown): HiggsfieldSubmissionError {
  if (error instanceof HiggsfieldSubmissionError) return error;
  if (error instanceof CredentialsMissedError) {
    return new HiggsfieldSubmissionError(
      "Higgsfield credentials are missing or malformed. Update them in Settings.",
      401,
      false,
    );
  }
  if (error instanceof AuthenticationError) {
    return new HiggsfieldSubmissionError(
      "Invalid Higgsfield credentials. Update them in Settings.",
      401,
      false,
    );
  }
  if (error instanceof NotEnoughCreditsError) {
    return new HiggsfieldSubmissionError("Higgsfield account has insufficient credits.", 402, false);
  }
  if (error instanceof ValidationError) {
    return new HiggsfieldSubmissionError(error.message || "Higgsfield rejected the input.", 422, false);
  }
  if (error instanceof BadInputError) {
    return new HiggsfieldSubmissionError(error.message || "Higgsfield rejected the input.", 400, false);
  }
  if (error instanceof TimeoutError) {
    return new HiggsfieldSubmissionError(
      "The Higgsfield submission timed out and its outcome is unknown. Check the Higgsfield console before trying again.",
      504,
      true,
    );
  }
  if (error instanceof APIError && error.statusCode) {
    const status = error.statusCode === 403 ? 402 : Math.min(599, Math.max(400, error.statusCode));
    return new HiggsfieldSubmissionError(error.message || "Higgsfield rejected the request.", status, false);
  }

  // Fetch/network failures happen after the request may have left this process.
  // Marking them ambiguous prevents an automatic or accidental resubmission.
  return new HiggsfieldSubmissionError(
    "The Higgsfield submission could not be confirmed. Check the Higgsfield console before trying again.",
    502,
    true,
  );
}
