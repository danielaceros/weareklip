import { NextResponse } from "next/server";
import { gaServerEvent } from "@/lib/ga-server";

let cachedLanguages: { name: string; code: string }[] | null = null;
let lastFetch = 0;

export async function GET() {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  // ⚡ Usar cache si no ha caducado
  if (cachedLanguages && now - lastFetch < oneDay) {
    await gaServerEvent("submagic_languages_cache_hit", {
      count: cachedLanguages.length,
    });
    return NextResponse.json({ languages: cachedLanguages });
  }

  try {
    // Solicitar las lenguas desde la API de klipcap
    const r = await fetch("https://api.klipcap.co/v1/languages", {
      headers: { "x-api-key": process.env.SUBMAGIC_API_KEY! },
    });

    // Si la respuesta no es exitosa, registrar el error
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      await gaServerEvent("submagic_languages_failed", {
        status: r.status,
        details: err,
      });
      return NextResponse.json(err, { status: r.status });
    }

    // Procesar la respuesta y actualizar la caché
    const data = await r.json();
    cachedLanguages = data.languages;
    lastFetch = now;

    // Evento de éxito en la obtención de lenguajes
    await gaServerEvent("submagic_languages_fetched", {
      count: cachedLanguages!.length,
    });

    return NextResponse.json({ languages: cachedLanguages });
  } catch (e: any) {
    // Manejo de errores generales
    console.error("❌ Error fetching klipcap languages:", e);
    await gaServerEvent("submagic_languages_failed", {
      reason: e?.message || "internal_error",
    });
    return NextResponse.json({ error: "Error fetching languages" }, { status: 500 });
  }
}
