"use client";
import { estimateGenerationCost, type CostOptions } from "@/lib/generationCost";

export function GenerationCost(props: CostOptions) {
  const estimate = estimateGenerationCost(props);
  return <div className="nodrag nopan" data-slot="generation-cost" title={estimate.detail}
    style={{ position: "absolute", top: "100%", left: 0, right: 0, padding: "7px 4px", fontSize: 12, lineHeight: 1.4, color: "var(--ms-text-secondary)", cursor: "help" }}>
    <span>Custo estimado: </span><strong style={{ color: "var(--ms-text)", fontWeight: 500 }}>{estimate.label}</strong>
    {props.count && props.count > 1 ? <span> · lote de {props.count}</span> : null}
  </div>;
}
