import { env } from "cloudflare:workers";
import { handleRoomsApi } from "@/lib/rooms-api.mjs";

export async function POST(request: Request) {
  return handleRoomsApi(request, env.DB);
}
