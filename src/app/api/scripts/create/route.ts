// src/app/api/script/create/route.ts
import type { NextRequest } from "next/server";
import * as provider from "@/app/api/chatgpt/scripts/create/route";

type Handler = (req: NextRequest, ctx: any) => Promise<Response> | Response;

function methodNotAllowed(): Response {
  return new Response("Method Not Allowed", { status: 405 });
}

function pick(method: "GET" | "POST"): Handler | null {
  const anyProvider = provider as Record<string, unknown>;
  const fn = anyProvider[method];
  return typeof fn === "function" ? (fn as Handler) : null;
}

export async function GET(req: NextRequest, ctx: any) {
  const h = pick("GET");
  return h ? h(req, ctx) : methodNotAllowed();
}

export async function POST(req: NextRequest, ctx: any) {
  const h = pick("POST");
  return h ? h(req, ctx) : methodNotAllowed();
}

// ⚠️ Exports deben ser literales en Next 15
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
