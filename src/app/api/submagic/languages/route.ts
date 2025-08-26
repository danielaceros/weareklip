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
    const r = await fetch("https://api.submagic.co/v1/languages", {
      headers: { "x-api-key": process.env.SUBMAGIC_API_KEY! },
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      await gaServerEvent("submagic_languages_failed", {
        status: r.status,
        details: err,
      });
      return NextResponse.json(err, { status: r.status });
    }

    const data = await r.json();
    cachedLanguages = data.languages;
    lastFetch = now;

    await gaServerEvent("submagic_languages_fetched", {
      count: cachedLanguages?.length ?? 0,
    });

    return NextResponse.json({ languages: cachedLanguages });
  } catch (e: any) {
    console.error("❌ Error fetching Submagic languages:", e);
    await gaServerEvent("submagic_languages_failed", {
      reason: e?.message || "internal_error",
    });
    return NextResponse.json({ error: "Error fetching languages" }, { status: 500 });
  }
}
