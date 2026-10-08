import { codexChatStatus } from "@/lib/codexProcess";

export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(await codexChatStatus());
}
