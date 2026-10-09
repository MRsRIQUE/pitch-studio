import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Node, Edge } from "@xyflow/react";
import type { NodeData } from "./store";
export interface LibraryWorkflow { id: string; name: string; nodes: Node<NodeData>[]; edges: Edge[]; createdAt: number }
export interface LibraryAsset { id: string; name: string; url: string; kind: "image" | "video" | "audio"; folder: string; favorite: boolean; createdAt: number }
interface Library { workflows: LibraryWorkflow[]; assets: LibraryAsset[]; favorites: string[]; addWorkflow: (value: Omit<LibraryWorkflow, "id" | "createdAt">) => void; removeWorkflow: (id: string) => void; addAsset: (value: Omit<LibraryAsset, "id" | "createdAt" | "favorite">) => void; updateAsset: (id: string, value: Partial<LibraryAsset>) => void; removeAssets: (ids: string[]) => void; toggleFavorite: (id: string) => void }
export const useProductionLibrary = create<Library>()(persist((set) => ({ workflows: [], assets: [], favorites: [], addWorkflow: value => set(s => ({ workflows: [...s.workflows, { ...structuredClone(value), id: crypto.randomUUID(), createdAt: Date.now() }] })), removeWorkflow: id => set(s => ({ workflows: s.workflows.filter(w => w.id !== id) })), addAsset: value => set(s => ({ assets: [...s.assets, { ...value, id: crypto.randomUUID(), createdAt: Date.now(), favorite: false }] })), updateAsset: (id, value) => set(s => ({ assets: s.assets.map(a => a.id === id ? { ...a, ...value } : a) })), removeAssets: ids => set(s => ({ assets: s.assets.filter(a => !ids.includes(a.id)) })), toggleFavorite: id => set(s => ({ favorites: s.favorites.includes(id) ? s.favorites.filter(f => f !== id) : [...s.favorites, id] })) }), { name: "pitch-production-library" }));
export function cloneLibraryWorkflow(workflow: Pick<LibraryWorkflow, "nodes" | "edges">, offset = { x: 0, y: 0 }) {
  const map = new Map(workflow.nodes.map(n => [n.id, crypto.randomUUID()]));
  const nodes = workflow.nodes.map(n => ({ ...structuredClone(n), id: map.get(n.id)!, parentId: n.parentId ? map.get(n.parentId) : undefined, position: n.parentId && map.has(n.parentId) ? n.position : { x: n.position.x + offset.x, y: n.position.y + offset.y }, selected: false, data: { ...structuredClone(n.data), status: "idle" as const, pendingGenerate: false, pipelineQueued: false, taskId: undefined } }));
  const edges = workflow.edges.filter(e => map.has(e.source) && map.has(e.target)).map(e => ({ ...e, id: crypto.randomUUID(), source: map.get(e.source)!, target: map.get(e.target)! }));
  return { nodes, edges };
}
