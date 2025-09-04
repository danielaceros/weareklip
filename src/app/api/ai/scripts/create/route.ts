// Wrapper que delega en /api/chatgpt/scripts/create/route sin exigir exports en compile-time
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Handler = (req: NextRequest, ctx: any) => Promise<Response> | Response;

function methodNotAllowed(): Response {
  return new Response("Method Not Allowed", { status: 405 });
}

async function loadProvider() {
  try {
    return await import("@/app/api/chatgpt/scripts/create/route");
  } catch {
    return null;
  }
}

function pick(mod: any, method: "GET" | "POST"): Handler | null {
  const fn = mod && typeof mod[method] === "function" ? (mod[method] as Handler) : null;
  return fn;
}

export async function GET(req: NextRequest, ctx: any) {
  const mod = await loadProvider();
  const h = pick(mod, "GET");
  return h ? h(req, ctx) : methodNotAllowed();
}

export async function POST(req: NextRequest, ctx: any) {
  const mod = await loadProvider();
  const h = pick(mod, "POST");
  return h ? h(req, ctx) : methodNotAllowed();
}
