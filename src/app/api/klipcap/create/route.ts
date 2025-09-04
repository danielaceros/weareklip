// Minimal provider para creación de captions (stub)
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // TODO: Conectar con tu proveedor real de captions.
  // Devolvemos 501 para que quede claro que es un stub.
  const body = await req.json().catch(() => ({}));
  return Response.json(
    {
      ok: false,
      error: "Klipcap provider not implemented",
      received: body,
    },
    { status: 501 }
  );
}

export async function GET() {
  return new Response("Method Not Allowed", { status: 405 });
}
