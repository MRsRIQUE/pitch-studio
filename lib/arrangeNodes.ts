import type { Node } from "@xyflow/react";
import { useWorkflowStore } from "@/lib/store";

const ANIM = "transform 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94)";

/**
 * Arranges the given node IDs into a compact aligned grid.
 * The overall center never moves:
 *  - With groupId: centers around the group rectangle's current center.
 *  - Without groupId: centers around the selection's current bounding-box center.
 * The group rectangle itself is never repositioned or resized.
 */
export function arrangeNodes(nodeIds: string[], options?: { groupId?: string; gap?: number }) {
  const { groupId, gap = 56 } = options ?? {};
  const state = useWorkflowStore.getState();
  const pool = state.nodes.filter((n) => nodeIds.includes(n.id));
  if (pool.length < 2) return;

  const sorted = [...pool].sort((a, b) =>
    a.position.x !== b.position.x ? a.position.x - b.position.x : a.position.y - b.position.y
  );

  const cols = sorted.length <= 4 ? sorted.length : Math.ceil(Math.sqrt(sorted.length));
  const rows: Node[][] = [];
  for (let i = 0; i < sorted.length; i += cols) rows.push(sorted.slice(i, i + cols));

  const colWidths: number[] = Array(cols).fill(0);
  for (const row of rows) {
    row.forEach((n, ci) => {
      colWidths[ci] = Math.max(colWidths[ci], n.measured?.width ?? (n.width as number) ?? 240);
    });
  }
  const rowHeights = rows.map((row) =>
    Math.max(...row.map((n) => n.measured?.height ?? (n.height as number) ?? 160))
  );

  const totalW = colWidths.reduce((s, w) => s + w, 0) + gap * (cols - 1);
  const totalH = rowHeights.reduce((s, h) => s + h, 0) + gap * (rows.length - 1);

  // Determine the fixed center point
  let centerX: number;
  let centerY: number;

  if (groupId) {
    const g = state.nodes.find((n) => n.id === groupId);
    const gw = g?.measured?.width ?? (g?.style?.width as number | undefined) ?? 400;
    const gh = g?.measured?.height ?? (g?.style?.height as number | undefined) ?? 300;
    centerX = (g?.position.x ?? 0) + gw / 2;
    centerY = (g?.position.y ?? 0) + gh / 2;
  } else {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of sorted) {
      const w = n.measured?.width ?? (n.width as number) ?? 240;
      const h = n.measured?.height ?? (n.height as number) ?? 160;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    }
    centerX = (minX + maxX) / 2;
    centerY = (minY + maxY) / 2;
  }

  const startX = centerX - totalW / 2;
  const startY = centerY - totalH / 2;

  const targets: Record<string, { x: number; y: number }> = {};
  let y = startY;
  rows.forEach((row, ri) => {
    let x = startX;
    row.forEach((n, ci) => {
      targets[n.id] = { x, y };
      x += colWidths[ci] + gap;
    });
    y += rowHeights[ri] + gap;
  });

  const updated = state.nodes.map((n) => {
    const target = targets[n.id];
    if (!target) return n;
    return { ...n, position: target, style: { ...n.style, transition: ANIM } };
  });

  useWorkflowStore.setState((s) => ({
    nodes: updated,
    spaces: s.spaces.map((sp) => sp.id === s.activeSpaceId ? { ...sp, nodes: updated } : sp),
  }));

  setTimeout(() => {
    useWorkflowStore.setState((s) => {
      const cleaned = s.nodes.map((n) => {
        if (!targets[n.id]) return n;
        const { transition: _, ...rest } = (n.style ?? {}) as Record<string, unknown>;
        return { ...n, style: rest };
      });
      return {
        nodes: cleaned,
        spaces: s.spaces.map((sp) => sp.id === s.activeSpaceId ? { ...sp, nodes: cleaned } : sp),
      };
    });
  }, 450);
}
