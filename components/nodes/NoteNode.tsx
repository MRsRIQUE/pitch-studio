"use client";
import { NodeProps, Node } from "@xyflow/react";
import { useWorkflowStore, NodeData } from "@/lib/store";

type NoteNodeType = Node<NodeData, "noteNode">;

export default function NoteNode({ id, data }: NodeProps<NoteNodeType>) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);

  return (
    <div className="bg-yellow-950/80 border border-yellow-800/60 rounded-xl w-52 shadow-md">
      <div className="px-3 py-2 border-b border-yellow-800/40 text-yellow-300 text-xs font-semibold">
        📝 Note
      </div>
      <textarea
        className="w-full bg-transparent text-yellow-200 text-xs p-2 resize-none focus:outline-none min-h-[60px] placeholder-yellow-700"
        placeholder="Add a note…"
        value={data.prompt ?? ""}
        onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
      />
    </div>
  );
}
