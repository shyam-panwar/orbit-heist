import { env } from "cloudflare:workers";
import { handleRoomsApi } from "@/lib/rooms-api.mjs";

export async function GET(request: Request) {
  return handleRoomsApi(request, env.DB);
}
