import type { NextRequest } from "next/server";
import * as provider from "@/app/api/elevenlabs/audio/regenerate/route";

type Handler = (req: NextRequest, ctx: any) => Promise<Response> | Response;

function methodNotAllowed(): Response {
  return new Response("Method Not Allowed", { status: 405 });
}

function getHandler(method: "GET" | "POST"): Handler | null {
  const mod = provider as Record<string, unknown>;
  const h = mod[method];
  return typeof h === "function" ? (h as Handler) : null;
}

export async function GET(req: NextRequest, ctx: any) {
  const h = getHandler("GET");
  return h ? h(req, ctx) : methodNotAllowed();
}

export async function POST(req: NextRequest, ctx: any) {
  const h = getHandler("POST");
  return h ? h(req, ctx) : methodNotAllowed();
}
