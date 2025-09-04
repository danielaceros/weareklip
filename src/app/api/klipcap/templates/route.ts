// Listado de templates (stub seguro para UI)
export const dynamic = "force-dynamic";

export async function GET() {
  // Ajusta el shape si tu UI espera otras keys.
  return Response.json({
    templates: [
      { id: "classic", label: "Classic" },
      { id: "bold", label: "Bold" },
      { id: "karaoke", label: "Karaoke" },
    ],
  });
}

export async function POST() {
  return new Response("Method Not Allowed", { status: 405 });
}
