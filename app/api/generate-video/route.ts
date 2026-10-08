import { NextRequest, NextResponse } from "next/server";
import { jobStore } from "@/lib/jobStore";
import { pollKieJob } from "@/lib/kieJobPoller";
import { rewriteLocalMediaForKie } from "@/lib/kieUpload";
import { ensureR2 } from "@/lib/storage";
import { VIDEO_MODELS } from "@/lib/modelConfig";
import { getKieTokenForUser } from "@/lib/getKieToken";
import { GUEST_USER_ID } from "@/lib/guestMode";
import { shouldMock, startMockJob } from "@/lib/mockProvider";
import {
  HIGGSFIELD_GENJUTSU_MOTION_ENDPOINT,
  HIGGSFIELD_GENJUTSU_OBJECT_ENDPOINT,
  HIGGSFIELD_SEEDANCE_2_ENDPOINT,
  ensureHiggsfieldReachableMedia,
  normalizeHiggsfieldSubmissionError,
  submitHiggsfieldGeneration,
  type HiggsfieldEndpoint,
  type HiggsfieldGenjutsuInput,
  type HiggsfieldTextToVideoInput,
} from "@/lib/higgsfieldProvider";
import { pollHiggsfieldJob } from "@/lib/higgsfieldJobPoller";
import * as guestDb from "@/lib/guest/db";

const KIE_BASE = "https://api.kie.ai";

interface Resource {
  url: string;
  label: string;
}

interface KlingElementInput {
  name: string;
  description: string;
  imageUrls: string[];
}


export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  const {
    videoModel      = body.model || "kling-3.0",
    prompt,
    startFrameUrl:  rawStartFrame,
    endFrameUrl:    rawEndFrame,
    videoRefUrl:    rawVideoRef,
    resources       = [] as Resource[],
    klingElements   = [] as KlingElementInput[],
    referenceImageUrls:  rawRefImages     = body.imageUrls || [] as string[],
    referenceVideoUrls:  rawRefVideoUrls  = [] as string[],
    referenceAudioUrls:  rawRefAudioUrls  = [] as string[],
    sound           = false,
    duration        = 5,
    aspectRatio     = body.aspect_ratio || "16:9",
    mode            = "pro",
    resolution:     rawResolution,
    seed,
    veoMode,
    generationType: rawGenerationType,
    callBackUrl:    rawCallBackUrl,
    debugOnly       = false,
    submissionId,
  } = body;

  const userId = GUEST_USER_ID;

  const cfg = VIDEO_MODELS.find((m) => m.id === videoModel);
  if (!cfg) return NextResponse.json({ error: `Unknown video model: ${videoModel}` }, { status: 400 });

  const resolution = rawResolution || cfg.defaultResolution || "480p";
  const { apiInput } = cfg;
  const isSeedance25EditModel = cfg.id === "seedance-2-5-edit";
  const effectiveAspectRatio = isSeedance25EditModel ? "adaptive" : aspectRatio;

  // Clamp duration to model limits (motion-control has no duration field)
  const clampedDuration = isSeedance25EditModel
    ? -1
    : apiInput.durationMax > 0
    ? Math.max(apiInput.durationMin, Math.min(apiInput.durationMax, Number(duration)))
    : 0;

  if (apiInput.useHiggsfield) {
    const cleanPrompt = typeof prompt === "string" ? prompt.trim() : "";
    if (cleanPrompt.length > (apiInput.promptMaxLength ?? 10_000)) {
      return NextResponse.json({ error: "The prompt is too long." }, { status: 400 });
    }

    const isGenjutsu = Boolean(apiInput.useHiggsfieldGenjutsu);
    const rawGenjutsuImages = Array.isArray(rawRefImages)
      ? rawRefImages.filter((value): value is string => typeof value === "string" && value.length > 0).slice(0, 9)
      : [];
    let endpointId: HiggsfieldEndpoint = HIGGSFIELD_SEEDANCE_2_ENDPOINT;
    let debugInput: HiggsfieldTextToVideoInput | HiggsfieldGenjutsuInput;
    let numericDuration = Number(duration);

    if (isGenjutsu) {
      if (typeof rawVideoRef !== "string" || rawVideoRef.length === 0) {
        return NextResponse.json({ error: "Genjutsu requires a source video." }, { status: 400 });
      }
      if (rawGenjutsuImages.length < 1 || rawGenjutsuImages.length > 8) {
        return NextResponse.json({ error: "Genjutsu requires from 1 to 8 reference images." }, { status: 400 });
      }
      if (resolution !== "480p" && resolution !== "720p") {
        return NextResponse.json({ error: "Genjutsu resolution must be 480p or 720p." }, { status: 400 });
      }
      endpointId = cfg.id === "higgsfield-genjutsu-object-swap"
        ? HIGGSFIELD_GENJUTSU_OBJECT_ENDPOINT
        : HIGGSFIELD_GENJUTSU_MOTION_ENDPOINT;
      debugInput = {
        prompt: cleanPrompt,
        video_url: rawVideoRef,
        image_urls: rawGenjutsuImages,
        resolution,
      };
      numericDuration = 0;
    } else {
      const allowedResolutions = new Set(["480p", "720p", "1080p", "4k"]);
      const allowedRatios = new Set(["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"]);
      if (!cleanPrompt) {
        return NextResponse.json({ error: "A prompt is required for Higgsfield Seedance 2.0." }, { status: 400 });
      }
      if (!Number.isInteger(numericDuration) || numericDuration < 4 || numericDuration > 15) {
        return NextResponse.json({ error: "Higgsfield duration must be an integer from 4 to 15 seconds." }, { status: 400 });
      }
      if (!allowedResolutions.has(resolution)) {
        return NextResponse.json({ error: "Unsupported Higgsfield resolution." }, { status: 400 });
      }
      if (!allowedRatios.has(aspectRatio)) {
        return NextResponse.json({ error: "Unsupported Higgsfield aspect ratio." }, { status: 400 });
      }
      debugInput = {
        prompt: cleanPrompt,
        resolution: resolution as HiggsfieldTextToVideoInput["resolution"],
        generate_audio: Boolean(sound),
        duration: numericDuration,
        aspect_ratio: aspectRatio as HiggsfieldTextToVideoInput["aspect_ratio"],
      };
    }

    const endpoint = `https://api.higgsfield.ai/${endpointId}`;

    if (debugOnly) {
      return NextResponse.json({
        debugPayload: debugInput,
        debugEndpoint: endpoint,
        transport: "@higgsfield/client (polling disabled for initial submission)",
      });
    }

    if (typeof submissionId !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(submissionId)) {
      return NextResponse.json({ error: "A valid submissionId is required." }, { status: 400 });
    }

    const credentials = guestDb.getHiggsfieldCredentials();
    if (!credentials) {
      return NextResponse.json(
        { error: "No Higgsfield credentials configured. Add them in Settings." },
        { status: 401 },
      );
    }

    const claim = guestDb.claimGenerationSubmission(submissionId, userId, "higgsfield");
    if (!claim.claimed) {
      if (claim.existing.user_id !== userId || claim.existing.provider !== "higgsfield") {
        return NextResponse.json({ error: "Submission not found." }, { status: 404 });
      }
      if (claim.existing.state === "accepted" && claim.existing.task_id) {
        return NextResponse.json({ taskId: claim.existing.task_id, deduplicated: true });
      }
      const message = claim.existing.state === "uncertain"
        ? "The prior submission outcome is unknown. Check the Higgsfield console before submitting again."
        : "This generation is already being submitted.";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    let input = debugInput;
    if (isGenjutsu) {
      try {
        const [videoUrl, imageUrls] = await Promise.all([
          ensureHiggsfieldReachableMedia(rawVideoRef as string, credentials),
          Promise.all(rawGenjutsuImages.map((url) => ensureHiggsfieldReachableMedia(url, credentials))),
        ]);
        if (videoUrl.length > 2083 || imageUrls.some((url) => url.length > 2083)) {
          guestDb.releaseGenerationSubmission(submissionId);
          return NextResponse.json({ error: "A Higgsfield media URL is too long." }, { status: 400 });
        }
        input = { ...debugInput, video_url: videoUrl, image_urls: imageUrls } as HiggsfieldGenjutsuInput;
      } catch (error) {
        guestDb.releaseGenerationSubmission(submissionId);
        const normalized = normalizeHiggsfieldSubmissionError(error);
        console.error("[generate-video] Higgsfield media upload failed:", normalized.message);
        return NextResponse.json(
          { error: `Higgsfield media upload failed: ${normalized.message}` },
          { status: normalized.httpStatus },
        );
      }
    }

    try {
      const created = await submitHiggsfieldGeneration(credentials, endpointId, input);
      const taskId = created.request_id;
      if (!taskId) {
        guestDb.markGenerationSubmissionUncertain(submissionId);
        return NextResponse.json(
          { error: "Higgsfield accepted the request but did not return a request ID. Check the console before trying again." },
          { status: 502 },
        );
      }

      guestDb.acceptGenerationSubmission(submissionId, taskId);
      jobStore.set(taskId, {
        status: "pending",
        type: "video",
        userId,
        provider: "higgsfield",
        statusUrl: created.status_url,
      });
      guestDb.insertGeneration({
        task_id: taskId,
        user_id: userId,
        generation_type: "video",
        status: "pending",
        model: videoModel,
        prompt: cleanPrompt,
        aspect_ratio: isGenjutsu ? undefined : aspectRatio,
        duration: isGenjutsu ? undefined : numericDuration,
        sound: Boolean(sound),
        reference_image_urls: isGenjutsu ? rawGenjutsuImages : [],
      });
      pollHiggsfieldJob(taskId, credentials, created.status_url, userId, created);
      return NextResponse.json({ taskId });
    } catch (error) {
      const normalized = normalizeHiggsfieldSubmissionError(error);
      if (normalized.ambiguous) guestDb.markGenerationSubmissionUncertain(submissionId);
      else guestDb.releaseGenerationSubmission(submissionId);
      console.error("[generate-video] Higgsfield submission failed:", normalized.message);
      return NextResponse.json({ error: normalized.message }, { status: normalized.httpStatus });
    }
  }

  const apiKey = (await getKieTokenForUser()) ?? process.env.KIE_API_TOKEN ?? null;

  // Sem chave kie.ai: cai no provider simulado (lib/mockProvider.ts) para o app
  // continuar navegável de ponta a ponta. MOCK_GENERATION=false desliga isso.
  if (shouldMock(apiKey)) {
    const taskId = startMockJob({
      kind:        "video",
      prompt:      typeof prompt === "string" ? prompt : "",
      model:       videoModel,
      aspectRatio,
      duration:    Number(duration) || undefined,
      userId,
    });
    return NextResponse.json({ taskId });
  }

  if (!apiKey) return NextResponse.json({ error: "No Kie.ai API key configured. Add one in Settings." }, { status: 401 });

  // The app polls kie.ai directly (lib/kieJobPoller) — no callback URL needed.
  const callBackUrl = rawCallBackUrl || undefined;

  let input: Record<string, unknown>;
  let effectiveApiId = cfg.apiId;

  if (apiInput.useMotionControl) {
    // ── Kling 2.6 motion control ──────────────────────────────────────────────
    // { prompt, input_urls, video_urls, mode, character_orientation }
    const [inputImageUrl, inputVideoUrl] = await Promise.all([
      rawStartFrame ? ensureR2(rawStartFrame, "references").catch(() => rawStartFrame) : Promise.resolve(undefined),
      rawVideoRef   ? ensureR2(rawVideoRef,   "references").catch(() => rawVideoRef)   : Promise.resolve(undefined),
    ]);

    input = {
      prompt:                prompt ?? "",
      input_urls:            inputImageUrl ? [inputImageUrl] : [],
      video_urls:            inputVideoUrl ? [inputVideoUrl] : [],
      mode:                  resolution,   // "720p" or "1080p"
      character_orientation: mode,         // "image" or "video"
    };
    if (apiInput.extra) Object.assign(input, apiInput.extra);

  } else if (apiInput.useMinimaxH3) {
    // ── MiniMax H3 (text / image / reference to video) ───────────────────────
    const [startFrameUrl, endFrameUrl, r2RefImages, r2RefVideos, r2RefAudios] = await Promise.all([
      rawStartFrame ? ensureR2(rawStartFrame, "references").catch(() => rawStartFrame) : Promise.resolve(undefined),
      rawEndFrame   ? ensureR2(rawEndFrame,   "references").catch(() => rawEndFrame)   : Promise.resolve(undefined),
      Promise.all((rawRefImages    as string[]).map((u) => ensureR2(u, "references").catch(() => u))),
      Promise.all((rawRefVideoUrls as string[]).map((u) => ensureR2(u, "references").catch(() => u))),
      Promise.all((rawRefAudioUrls as string[]).map((u) => ensureR2(u, "references").catch(() => u))),
    ]);

    if (startFrameUrl || endFrameUrl) {
      // image-to-video — frames take priority over references
      effectiveApiId = cfg.imageApiId!;
      input = {
        prompt:                 prompt ?? "",
        [apiInput.durationKey!]: clampedDuration,
      };
      if (startFrameUrl)          input[apiInput.firstFrameKey!] = startFrameUrl;
      if (endFrameUrl)            input[apiInput.lastFrameKey!]  = endFrameUrl;
      if (apiInput.resolutionKey) input[apiInput.resolutionKey]  = resolution;
    } else if (r2RefImages.length > 0) {
      // reference-to-video
      effectiveApiId = "minimax-h3/reference-to-video";
      input = {
        prompt:                     prompt ?? "",
        [apiInput.referenceImagesKey!]: r2RefImages.slice(0, 9),
        [apiInput.aspectRatioKey!]: aspectRatio,
        [apiInput.durationKey!]:    clampedDuration,
      };
      // reference_audio cannot be used alone — it always rides along with images here
      if (r2RefVideos.length > 0 && apiInput.referenceVideosKey) input[apiInput.referenceVideosKey] = r2RefVideos.slice(0, 3);
      if (r2RefAudios.length > 0 && apiInput.referenceAudiosKey) input[apiInput.referenceAudiosKey] = r2RefAudios.slice(0, 3);
      if (apiInput.resolutionKey) input[apiInput.resolutionKey] = resolution;
    } else {
      // text-to-video
      effectiveApiId = cfg.apiId;
      input = {
        prompt:                     prompt ?? "",
        [apiInput.aspectRatioKey!]: aspectRatio,
        [apiInput.durationKey!]:    clampedDuration,
      };
      if (apiInput.resolutionKey) input[apiInput.resolutionKey] = resolution;
    }

  } else if (apiInput.firstFrameKey) {
    // ── Seedance-style models (separate frame keys + multi-ref arrays) ─────────
    const [startFrameUrl, endFrameUrl, r2RefImages, r2RefVideos, r2RefAudios] = await Promise.all([
      rawStartFrame ? ensureR2(rawStartFrame, "references").catch(() => rawStartFrame) : Promise.resolve(undefined),
      rawEndFrame   ? ensureR2(rawEndFrame,   "references").catch(() => rawEndFrame)   : Promise.resolve(undefined),
      Promise.all((rawRefImages    as string[]).map((u) => ensureR2(u, "references").catch(() => u))),
      Promise.all((rawRefVideoUrls as string[]).map((u) => ensureR2(u, "references").catch(() => u))),
      Promise.all((rawRefAudioUrls as string[]).map((u) => ensureR2(u, "references").catch(() => u))),
    ]);

    input = {
      [apiInput.aspectRatioKey!]: effectiveAspectRatio,
      [apiInput.durationKey!]:    clampedDuration,
    };

    if (prompt?.trim())                                        input.prompt                       = prompt;
    if (apiInput.firstFrameKey  && startFrameUrl)              input[apiInput.firstFrameKey]       = startFrameUrl;
    if (apiInput.lastFrameKey   && endFrameUrl)                input[apiInput.lastFrameKey]        = endFrameUrl;
    if (apiInput.resolutionKey)                                input[apiInput.resolutionKey]       = resolution;
    if (apiInput.soundKey)                                     input[apiInput.soundKey]            = Boolean(sound);
    // Seedance (and similar): first/last frames and reference images are mutually exclusive
    if (apiInput.referenceImagesKey && r2RefImages.length > 0 && !startFrameUrl && !endFrameUrl) input[apiInput.referenceImagesKey]  = r2RefImages;
    if (apiInput.referenceVideosKey && r2RefVideos.length > 0) input[apiInput.referenceVideosKey]  = r2RefVideos;
    if (apiInput.referenceAudiosKey && r2RefAudios.length > 0) input[apiInput.referenceAudiosKey]  = r2RefAudios;
    if (apiInput.extra)                                        Object.assign(input, apiInput.extra);

  } else if (apiInput.useHappyHorse) {
    // ── HappyHorse (Alibaba) — routes to text/image/reference endpoint ────────
    const refImageUrls = (
      await Promise.all(
        (rawRefImages as string[]).map((u) => ensureR2(u, "references").catch(() => null))
      )
    ).filter((u): u is string => u !== null);

    const startFrameUrl = rawStartFrame
      ? await ensureR2(rawStartFrame, "references").catch(() => rawStartFrame)
      : undefined;

    const maybeSeed = seed !== undefined && seed !== null && Number(seed) > 0 ? Number(seed) : undefined;

    if (refImageUrls.length > 0) {
      effectiveApiId = "happyhorse/reference-to-video";
      input = {
        prompt: prompt ?? "",
        reference_image: refImageUrls.slice(0, 9),
        [apiInput.aspectRatioKey!]: aspectRatio,
        [apiInput.durationKey!]:    clampedDuration,
      };
      if (apiInput.resolutionKey) input[apiInput.resolutionKey] = resolution;
      if (maybeSeed !== undefined && apiInput.seedKey) input[apiInput.seedKey] = maybeSeed;
    } else if (startFrameUrl) {
      effectiveApiId = "happyhorse/image-to-video";
      input = {
        image_urls:             [startFrameUrl],
        [apiInput.durationKey!]: clampedDuration,
      };
      if (prompt?.trim()) input.prompt = prompt;
      // resolution is determined by the input image — do not send it
      if (maybeSeed !== undefined && apiInput.seedKey) input[apiInput.seedKey] = maybeSeed;
    } else {
      effectiveApiId = "happyhorse/text-to-video";
      input = {
        prompt: prompt ?? "",
        [apiInput.aspectRatioKey!]: aspectRatio,
        [apiInput.durationKey!]:    clampedDuration,
      };
      if (apiInput.resolutionKey) input[apiInput.resolutionKey] = resolution;
      if (maybeSeed !== undefined && apiInput.seedKey) input[apiInput.seedKey] = maybeSeed;
    }

  } else if (apiInput.useKlingTurbo) {
    // ── Kling 3.0 Turbo (text-to-video / image-to-video) ─────────────────────
    const startFrameUrl = rawStartFrame
      ? await ensureR2(rawStartFrame, "references").catch(() => rawStartFrame)
      : undefined;

    const durationValue = String(clampedDuration);

    if (startFrameUrl) {
      effectiveApiId = cfg.imageApiId!;
      input = {
        prompt:              prompt ?? "",
        image_urls:          [startFrameUrl],
        [apiInput.durationKey!]: durationValue,
        [apiInput.resolutionKey!]: resolution,
      };
    } else {
      effectiveApiId = cfg.apiId;
      input = {
        prompt:                     prompt ?? "",
        [apiInput.aspectRatioKey!]: aspectRatio,
        [apiInput.durationKey!]:    durationValue,
        [apiInput.resolutionKey!]:  resolution,
      };
    }

  } else if (apiInput.useGoogleVeo) {
    // ── Google Veo 3.1 ───────────────────────────────────────────────────────
    const [startFrameUrl, endFrameUrl, refImages] = await Promise.all([
      rawStartFrame ? ensureR2(rawStartFrame, "references").catch(() => rawStartFrame) : Promise.resolve(undefined),
      rawEndFrame   ? ensureR2(rawEndFrame,   "references").catch(() => rawEndFrame)   : Promise.resolve(undefined),
      Promise.all((rawRefImages as string[]).map((u) => ensureR2(u, "references").catch(() => u))),
    ]);

    const imageUrls: string[] = [];
    let generationType = "TEXT_2_VIDEO";

    // For veo3.1 lite, if an image is attached use: Image to video, just a text is attached, use text to video.
    // On the two other models (fast/quality), one more element is present: reference.
    const isLite = cfg.id === "veo3_lite";

    if (veoMode === "references" && !isLite) {
      generationType = "REFERENCE_2_VIDEO";
      if (refImages.length > 0) imageUrls.push(...refImages.slice(0, 3));
    } else {
      if (startFrameUrl || endFrameUrl) {
        generationType = "FIRST_AND_LAST_FRAMES_2_VIDEO";
        if (startFrameUrl) imageUrls.push(startFrameUrl);
        if (endFrameUrl) imageUrls.push(endFrameUrl);
      }
    }

    effectiveApiId = cfg.apiId; // Use veo3, veo3_fast, or veo3_lite directly

    input = {
      prompt: prompt ?? "",
      generationType: rawGenerationType || generationType,
      [apiInput.aspectRatioKey!]: aspectRatio,
      [apiInput.resolutionKey!]: resolution,
      imageUrls: imageUrls,
      watermark: "",
      enableFallback: false,
      enableTranslation: true,
      callBackUrl,
    };
    if (apiInput.extra) Object.assign(input, apiInput.extra);

  } else if (apiInput.useGeminiOmniVideo) {
    // ── Gemini Omni Video (quota-based: image=1 slot, video=2 slots, max 7) ────
    const r2RefImages = await Promise.all(
      (rawRefImages as string[]).map((u) => ensureR2(u, "references").catch(() => u))
    );
    const r2RefVideos = await Promise.all(
      (rawRefVideoUrls as string[]).slice(0, 1).map((u) => ensureR2(u, "references").catch(() => u))
    );

    const videoSlots = r2RefVideos.length > 0 ? 2 : 0;
    const clampedImages = r2RefImages.slice(0, 7 - videoSlots);

    const maybeSeed = seed !== undefined && seed !== null && Number(seed) > 0 ? Number(seed) : undefined;

    input = { prompt: prompt ?? "" };
    if (clampedImages.length > 0) input.image_urls = clampedImages;
    if (r2RefVideos.length > 0)   input.video_list = r2RefVideos.map((url) => ({ url, start: 0, ends: 10 }));
    // duration is ignored by the model when video input is provided
    if (r2RefVideos.length === 0) input[apiInput.durationKey!] = String(clampedDuration);
    if (apiInput.aspectRatioKey)  input[apiInput.aspectRatioKey] = aspectRatio;
    if (apiInput.resolutionKey)   input[apiInput.resolutionKey]  = resolution;
    if (maybeSeed !== undefined && apiInput.seedKey) input[apiInput.seedKey] = maybeSeed;

  } else if (apiInput.referenceImagesKey) {
    // ── Reference-image-based models (Grok Imagine, Grok Imagine 1.5) ─────────
    const refImageUrls = (
      await Promise.all(
        (rawRefImages as string[]).map((u) => ensureR2(u, "references").catch(() => null))
      )
    ).filter((u): u is string => u !== null);

    const hasImages = refImageUrls.length > 0;
    effectiveApiId = hasImages && cfg.imageApiId ? cfg.imageApiId : cfg.apiId;

    const durationValue = apiInput.durationAsString ? String(clampedDuration) : clampedDuration;

    input = {
      prompt:                     prompt ?? "",
      [apiInput.aspectRatioKey!]: aspectRatio,
      [apiInput.durationKey!]:    durationValue,
    };

    if (apiInput.modeKey)       input[apiInput.modeKey]       = mode;
    if (apiInput.resolutionKey) input[apiInput.resolutionKey] = resolution;
    if (apiInput.extra)         Object.assign(input, apiInput.extra);
    if (hasImages) input[apiInput.referenceImagesKey] = refImageUrls;

  } else {
    // ── Start/end-frame + elements models (Kling) ─────────────────────────────
    const hasNewElements = (klingElements as KlingElementInput[]).length > 0;

    const [startFrameUrl, endFrameUrl, r2Resources, uploadedElements] = await Promise.all([
      rawStartFrame ? ensureR2(rawStartFrame, "references") : Promise.resolve(undefined),
      rawEndFrame   ? ensureR2(rawEndFrame,   "references") : Promise.resolve(undefined),
      hasNewElements
        ? Promise.resolve([] as Resource[])
        : Promise.all(
            (resources as Resource[]).slice(0, 3).map(async (r) => ({
              ...r,
              url: await ensureR2(r.url, "references").catch(() => r.url),
            }))
          ),
      hasNewElements
        ? Promise.all(
            (klingElements as KlingElementInput[]).slice(0, 3).map(async (el) => ({
              name:        el.name,
              description: el.description,
              imageUrls:   await Promise.all(
                el.imageUrls.map((u) => ensureR2(u, "references").catch(() => u))
              ),
            }))
          )
        : Promise.resolve([] as { name: string; description: string; imageUrls: string[] }[]),
    ]);

    input = {
      prompt:                     prompt ?? "",
      [apiInput.aspectRatioKey!]: aspectRatio,
      [apiInput.durationKey!]:    apiInput.durationAsString ? String(clampedDuration) : clampedDuration,
    };

    if (apiInput.modeKey)       input[apiInput.modeKey]       = mode;
    if (apiInput.soundKey)      input[apiInput.soundKey]      = Boolean(sound);
    if (apiInput.resolutionKey) input[apiInput.resolutionKey] = resolution;
    if (apiInput.extra)         Object.assign(input, apiInput.extra);

    if (apiInput.useImageUrls) {
      const image_urls: string[] = [];
      if (startFrameUrl) image_urls.push(startFrameUrl);
      if (endFrameUrl)   image_urls.push(endFrameUrl);
      if (image_urls.length > 0) input.image_urls = image_urls;
    }

    if (apiInput.useKlingElements) {
      let kling_elements: { name: string; description: string; element_input_urls: string[] }[] = [];
      if (hasNewElements) {
        kling_elements = uploadedElements.map((el) => ({
          name:               el.name,
          description:        el.description,
          element_input_urls: el.imageUrls.length >= 2 ? el.imageUrls : [el.imageUrls[0], el.imageUrls[0]],
        }));
      } else {
        kling_elements = r2Resources.map((r) => {
          const safeName = r.label.toLowerCase().replace(/\s+#/g, "_").replace(/[^a-z0-9_]/g, "") || "element";
          return { name: safeName, description: r.label, element_input_urls: [r.url, r.url] };
        });
      }
      if (kling_elements.length > 0) input.kling_elements = kling_elements;
    }
  }

  // kie.ai can't fetch our local reference media, so re-host any /generated or
  // data: URLs in the payload first.
  try {
    await rewriteLocalMediaForKie(input, apiKey);
  } catch (e) {
    return NextResponse.json(
      { error: `Couldn't upload reference media to kie.ai: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  // Submit task to kie.ai
  // Google Veo models require a dedicated endpoint and a flattened structure
  const endpoint = apiInput.useGoogleVeo
    ? `${KIE_BASE}/api/v1/veo/generate`
    : `${KIE_BASE}/api/v1/jobs/createTask`;

  const kieBody = apiInput.useGoogleVeo
    ? { model: effectiveApiId, ...input }
    : { model: effectiveApiId, callBackUrl, input };

  // Debug mode — log payload to server console and return without submitting
  if (debugOnly) {
    console.log(`[DEBUG] generate-video payload → ${endpoint}`, JSON.stringify(kieBody, null, 2));
    return NextResponse.json({ debugPayload: kieBody, debugEndpoint: endpoint });
  }

  console.log(`[generate-video] sending to ${endpoint}:`, JSON.stringify(kieBody));
  const createRes = await fetch(endpoint, {
    method:  "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body:    JSON.stringify(kieBody),
  });

  if (!createRes.ok) {
    if (createRes.status === 401) {
      return NextResponse.json({ error: "Invalid Kie.ai API key — please update it in Settings." }, { status: 401 });
    }
    const errText = await createRes.text();
    console.error("[generate-video] kie.ai HTTP error:", createRes.status, errText);
    return NextResponse.json({ error: errText }, { status: 500 });
  }

  const createdText = await createRes.text();
  console.log("[generate-video] kie.ai response:", createdText);
  let created: { code?: number; msg?: string; data?: { taskId?: string; id?: string } };
  try {
    created = JSON.parse(createdText);
  } catch {
    return NextResponse.json({ error: `Upstream returned non-JSON: ${createdText.slice(0, 200)}` }, { status: 500 });
  }
  if (created.code !== 200) {
    console.error("[generate-video] kie.ai API error:", created.code, created.msg, "input:", JSON.stringify(input));
    return NextResponse.json({ error: created.msg ?? "Task creation failed" }, { status: 500 });
  }

  const taskId = created.data?.taskId || created.data?.id;
  if (!taskId) return NextResponse.json({ error: "No taskId returned" }, { status: 500 });

  // Register as pending so the frontend can poll job-status
  jobStore.set(taskId, { status: "pending", type: "video", userId: userId ?? undefined });

  const referenceUrls: string[] = apiInput.useMotionControl
    ? [
        ...((input.input_urls as string[] | undefined) ?? []),
        ...((input.video_urls as string[] | undefined) ?? []),
      ]
    : apiInput.useGeminiOmniVideo
    ? [
        ...((input.image_urls as string[] | undefined) ?? []),
        ...((input.video_list as Array<{ url: string }> | undefined)?.map((v) => v.url) ?? []),
      ]
    : apiInput.useMinimaxH3
    ? [
        ...(input.first_frame_url ? [input.first_frame_url as string] : []),
        ...(input.last_frame_url  ? [input.last_frame_url as string]  : []),
        ...((input.reference_image_urls as string[] | undefined) ?? []),
        ...((input.reference_video_urls as string[] | undefined) ?? []),
        ...((input.reference_audio_urls as string[] | undefined) ?? []),
      ]
    : apiInput.referenceImagesKey
    ? (input[apiInput.referenceImagesKey] as string[] | undefined) ?? []
    : [
        ...((input.image_urls as string[] | undefined) ?? []),
        ...((input.kling_elements as Array<{ element_input_urls: string[] }> | undefined)
          ?.map((el) => el.element_input_urls[0]) ?? []),
      ];

  guestDb.insertGeneration({
    task_id: taskId, user_id: userId, generation_type: "video",
    status: "pending", model: videoModel, prompt, aspect_ratio: effectiveAspectRatio,
    duration: clampedDuration, kling_mode: mode,
    sound: cfg.sound ? Boolean(sound) : false,
    reference_image_urls: referenceUrls,
  });
  if (apiInput.useGoogleVeo) {
    console.warn("[generate-video] Veo has no jobs-API polling yet — result needs a callback URL");
  } else {
    pollKieJob(taskId, apiKey, "video");
  }

  return NextResponse.json({ taskId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const cause = e instanceof Error && (e as NodeJS.ErrnoException).cause;
    console.error("[generate-video] unhandled error:", msg, cause ?? "");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
