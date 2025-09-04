import type { NextRequest } from "next/server";
import * as provider from "@/app/api/klipcap/templates/route";

const notAllowed = () => new Response("Method Not Allowed", { status: 405 });

export async function GET(req: NextRequest, ctx: any) {
  const h = (provider as any).GET;
  return typeof h === "function" ? h(req, ctx) : notAllowed();
}
export async function POST(req: NextRequest, ctx: any) {
  const h = (provider as any).POST;
  return typeof h === "function" ? h(req, ctx) : notAllowed();
}
