// Listado de idiomas (stub seguro para UI)
export const dynamic = "force-dynamic";

export async function GET() {
  // Ajusta el shape si tu UI espera otras keys.
  return Response.json({
    languages: [
      { code: "es", label: "Español" },
      { code: "en", label: "English" },
      { code: "pt", label: "Português" },
      { code: "fr", label: "Français" },
    ],
  });
}

export async function POST() {
  return new Response("Method Not Allowed", { status: 405 });
}
