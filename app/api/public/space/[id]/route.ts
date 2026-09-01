import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("spaces")
    .select("id, name, data, is_public")
    .eq("id", id)
    .eq("is_public", true)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id:       data.id,
    name:     data.name,
    nodes:    data.data?.nodes    ?? [],
    edges:    data.data?.edges    ?? [],
    viewport: data.data?.viewport ?? null,
  });
}
