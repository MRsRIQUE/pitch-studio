"use client";
import { use } from "react";
import dynamic from "next/dynamic";

const PublicWorkflowViewer = dynamic(
  () => import("./PublicWorkflowViewer"),
  { ssr: false }
);

export default function PublicWorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PublicWorkflowViewer id={id} />;
}
