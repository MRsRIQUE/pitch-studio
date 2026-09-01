/**
 * In-memory transfer channel for files dropped directly onto the canvas.
 * WorkflowCanvas writes here after creating a new node; the node reads and
 * clears its entry on mount, then calls its own loadFile() handler.
 * Not persisted — intentionally ephemeral.
 */
export const pendingFiles = new Map<string, File>();
