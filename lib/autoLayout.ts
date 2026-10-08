import type { Node } from "@xyflow/react";
import { useWorkflowStore } from "@/lib/store";
import { requestWorkflowSync } from "@/lib/workflowSyncBus";
import { NODE_SIZE, FALLBACK_SIZE } from "@/lib/nodeTypes";

const ANIM = "transform 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const LAYER_GAP = 96; // horizontal gap between dependency layers
const ROW_GAP = 48;   // vertical gap between nodes stacked in the same layer

function nodeSize(n: Node): { w: number; h: number } {
  const fallback = NODE_SIZE[n.type ?? ""] ?? FALLBACK_SIZE;
  const w = n.measured?.width  ?? (typeof n.style?.width  === "number" ? n.style.width  : undefined) ?? fallback.w;
  const h = n.measured?.height ?? (typeof n.style?.height === "number" ? n.style.height : undefined) ?? fallback.h;
  return { w, h };
}

/**
 * Re-lays out the free-floating nodes of the active space left→right,
 * following the edges like a real flowchart: each node ranks by its
 * longest-path depth from a source (in-degree 0), so producers sit left of
 * their consumers. Within a rank, nodes stack top-to-bottom ordered by the
 * average position of their parents (a median heuristic), which keeps most
 * lines from crossing.
 *
 * Nodes that belong to a group, plus group/comment nodes themselves, are
 * left untouched — grouping and free-form notes are manual decisions this
 * pass must not undo. Returns false when there's nothing worth arranging.
 */
export function layoutWorkflow(): boolean {
  const state = useWorkflowStore.getState();

  const groupedIds = new Set<string>();
  for (const n of state.nodes) {
    if (n.type === "groupNode") {
      ((n.data?.memberIds as string[] | undefined) ?? []).forEach((id) => groupedIds.add(id));
    }
  }

  const pool = state.nodes.filter(
    (n) => n.type !== "groupNode" && n.type !== "commentNode" && !groupedIds.has(n.id)
  );
  if (pool.length < 2) return false;

  const poolIds = new Set(pool.map((n) => n.id));
  const relevantEdges = state.edges.filter((e) => poolIds.has(e.source) && poolIds.has(e.target));

  // ── Rank by longest-path depth from each source (in-degree 0 node) ───────
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const n of pool) { incoming.set(n.id, []); outgoing.set(n.id, []); }
  for (const e of relevantEdges) {
    incoming.get(e.target)!.push(e.source);
    outgoing.get(e.source)!.push(e.target);
  }

  const rank = new Map<string, number>();
  const inDegree = new Map<string, number>();
  for (const n of pool) inDegree.set(n.id, incoming.get(n.id)!.length);

  const queue = pool.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id);
  queue.forEach((id) => rank.set(id, 0));
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    const r = rank.get(id)!;
    for (const next of outgoing.get(id)!) {
      rank.set(next, Math.max(rank.get(next) ?? 0, r + 1));
      const d = inDegree.get(next)! - 1;
      inDegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  // Cycle guard — anything a cycle kept out of the queue lands in the first layer.
  for (const n of pool) if (!rank.has(n.id)) rank.set(n.id, 0);

  const maxRank = Math.max(...pool.map((n) => rank.get(n.id)!));
  const layers: Node[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const n of pool) layers[rank.get(n.id)!].push(n);

  // ── Order each layer by its parents' vertical position, then stack it;
  //    layers are walked in rank order so every parent's Y is already known ──
  const localY = new Map<string, number>();
  const layerHeights: number[] = [];
  for (const layer of layers) {
    layer.sort((a, b) => {
      const avg = (id: string, fallback: number) => {
        const parents = incoming.get(id)!;
        return parents.length
          ? parents.reduce((s, pid) => s + (localY.get(pid) ?? 0), 0) / parents.length
          : fallback;
      };
      return avg(a.id, a.position.y) - avg(b.id, b.position.y) || a.position.y - b.position.y;
    });

    let y = 0;
    for (const n of layer) {
      const { h } = nodeSize(n);
      localY.set(n.id, y + h / 2);
      y += h + ROW_GAP;
    }
    layerHeights.push(Math.max(0, y - ROW_GAP));
  }

  // Layers of different heights share a common vertical center.
  const totalHeight = Math.max(...layerHeights);
  const layerTop = layerHeights.map((h) => (totalHeight - h) / 2);

  // ── X per layer: cumulative max width of the layers to its left ──────────
  const layerWidths = layers.map((layer) => Math.max(...layer.map((n) => nodeSize(n).w)));
  const layerX: number[] = [];
  {
    let x = 0;
    for (const w of layerWidths) { layerX.push(x); x += w + LAYER_GAP; }
  }

  const centerTargets = new Map<string, { x: number; y: number }>();
  for (const [li, layer] of layers.entries()) {
    for (const n of layer) {
      centerTargets.set(n.id, {
        x: layerX[li] + nodeSize(n).w / 2,
        y: layerTop[li] + localY.get(n.id)!,
      });
    }
  }

  // ── Re-center the new layout on the pool's current bounding box, so the
  //    flow reorganizes in place instead of jumping away from the viewport ──
  let curMinX = Infinity, curMinY = Infinity, curMaxX = -Infinity, curMaxY = -Infinity;
  let newMinX = Infinity, newMinY = Infinity, newMaxX = -Infinity, newMaxY = -Infinity;
  for (const n of pool) {
    const { w, h } = nodeSize(n);
    curMinX = Math.min(curMinX, n.position.x);
    curMinY = Math.min(curMinY, n.position.y);
    curMaxX = Math.max(curMaxX, n.position.x + w);
    curMaxY = Math.max(curMaxY, n.position.y + h);

    const c = centerTargets.get(n.id)!;
    newMinX = Math.min(newMinX, c.x - w / 2);
    newMinY = Math.min(newMinY, c.y - h / 2);
    newMaxX = Math.max(newMaxX, c.x + w / 2);
    newMaxY = Math.max(newMaxY, c.y + h / 2);
  }
  const shift = {
    x: (curMinX + curMaxX) / 2 - (newMinX + newMaxX) / 2,
    y: (curMinY + curMaxY) / 2 - (newMinY + newMaxY) / 2,
  };

  const finalPositions = new Map<string, { x: number; y: number }>();
  for (const n of pool) {
    const c = centerTargets.get(n.id)!;
    const { w, h } = nodeSize(n);
    finalPositions.set(n.id, { x: c.x + shift.x - w / 2, y: c.y + shift.y - h / 2 });
  }

  // ── Apply — undo-able, and animated like the group's own "Arrange" ───────
  state.pushUndoSnapshot();

  const updated = state.nodes.map((n) => {
    const target = finalPositions.get(n.id);
    if (!target) return n;
    return { ...n, position: target, style: { ...n.style, transition: ANIM } };
  });

  useWorkflowStore.setState((s) => ({
    nodes: updated,
    spaces: s.spaces.map((sp) => (sp.id === s.activeSpaceId ? { ...sp, nodes: updated } : sp)),
  }));
  requestWorkflowSync();

  setTimeout(() => {
    useWorkflowStore.setState((s) => {
      const cleaned = s.nodes.map((n) => {
        if (!finalPositions.has(n.id)) return n;
        const { transition: _, ...rest } = (n.style ?? {}) as Record<string, unknown>;
        return { ...n, style: rest };
      });
      return {
        nodes: cleaned,
        spaces: s.spaces.map((sp) => (sp.id === s.activeSpaceId ? { ...sp, nodes: cleaned } : sp)),
      };
    });
  }, 450);

  return true;
}
