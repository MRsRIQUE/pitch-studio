import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { GUEST_MODE, resolveUserId } from "@/lib/guestMode";

export async function GET(req: NextRequest) {
  if (GUEST_MODE) {
    const { getAzureApiKey } = await import("@/lib/guest/db");
    return NextResponse.json({ hasToken: !!getAzureApiKey() });
  }

  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("user_settings")
    .select("azure_api_key")
    .eq("user_id", userId)
    .single();

  return NextResponse.json({ hasToken: !!data?.azure_api_key });
}

export async function POST(req: NextRequest) {
  if (GUEST_MODE) {
    const { azureApiKey } = await req.json();
    if (typeof azureApiKey !== "string" || !azureApiKey.trim()) {
      return NextResponse.json({ error: "azureApiKey is required" }, { status: 400 });
    }
    const { setAzureApiKey } = await import("@/lib/guest/db");
    setAzureApiKey(azureApiKey.trim());
    return NextResponse.json({ ok: true });
  }

  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { azureApiKey } = await req.json();
  if (typeof azureApiKey !== "string" || !azureApiKey.trim()) {
    return NextResponse.json({ error: "azureApiKey is required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("user_settings")
    .upsert({ user_id: userId, azure_api_key: azureApiKey.trim() }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (GUEST_MODE) {
    const { deleteAzureApiKey } = await import("@/lib/guest/db");
    deleteAzureApiKey();
    return NextResponse.json({ ok: true });
  }

  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabaseAdmin
    .from("user_settings")
    .update({ azure_api_key: null })
    .eq("user_id", userId);

  return NextResponse.json({ ok: true });
}
