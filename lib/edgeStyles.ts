import type { CSSProperties } from "react";

// Colours match the handle border colours exactly
export const EDGE_COLORS: Record<string, string> = {
  prompt: "#868CFF", // teal   — matches node-handle-icon-prompt
  image: "#ffb547", // orange — matches node-handle-icon-resource
  startFrame: "#868cff", // indigo — matches node-handle-icon-image
  endFrame: "#868cff", // indigo — matches node-handle-icon-image
  resource: "#ffb547", // orange — matches node-handle-icon-resource
  videoRef: "#0bc5ea", // cyan   — matches node-handle-icon-videoref
  referenceVideo: "#1b84ff", // sky    — matches node-handle-icon-refvideo
  audioRef: "#868cff", // violet — matches node-handle-icon-audioref
  character: "#01b574", // pink   — matches node-handle-icon-character (motion control startFrame)
  default: "#33334f", // neutral
};

// Handles that carry image data get a heavier stroke
const IMAGE_HANDLES = new Set(["image", "startFrame", "endFrame", "resource"]);

export function edgeStyle(targetHandle?: string | null | undefined): CSSProperties {
  const key = targetHandle ?? "default";
  const color = EDGE_COLORS[key] ?? EDGE_COLORS.default;
  const strokeWidth = IMAGE_HANDLES.has(key) ? 2.5 : 2;
  return { stroke: color, strokeWidth };
}

/** Returns the stroke color for a source (output) handle. */
export function getSourceHandleColor(nodeType: string | undefined, sourceHandleId: string | null | undefined): string {
  switch (sourceHandleId) {
    case "startFrameOut":
    case "endFrameOut":
    case "imagePickOut": return "#868cff";
    case "videoRefOut": return "#0bc5ea";
    case "audioRefOut": return "#868cff";
  }
  // Legacy / single-output nodes — derive from node type
  switch (nodeType) {
    case "promptNode": return "#868CFF";
    case "assistantNode": return "#FFB547";
    case "imageInputNode": return "#868cff";
    case "generateNode": return "#868cff";
    case "videoInputNode": return "#0bc5ea";
    case "videoGeneratorNode": return "#0bc5ea";
    default: return EDGE_COLORS.default;
  }
}
