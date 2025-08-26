// app/api/submagic/templates/route.ts
import { NextResponse } from "next/server";
import { gaServerEvent } from "@/lib/ga-server"; // 👈 asegúrate de tener este helper

let cachedTemplates: string[] | null = null;
let lastFetch = 0;

export async function GET() {
  const now = Date.now();
  const sixHours = 6 * 60 * 60 * 1000;

  // ⚡ Cache hit
  if (cachedTemplates && now - lastFetch < sixHours) {
    await gaServerEvent("submagic_templates_cache_hit", {
      count: cachedTemplates.length,
    });
    return NextResponse.json({ templates: cachedTemplates });
  }

  try {
    const r = await fetch("https://api.submagic.co/v1/templates", {
      headers: { "x-api-key": process.env.SUBMAGIC_API_KEY! },
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      await gaServerEvent("submagic_templates_failed", {
        status: r.status,
        details: err,
      });
      return NextResponse.json(err, { status: r.status });
    }

    const data = await r.json();
    cachedTemplates = data.templates;
    lastFetch = now;

    await gaServerEvent("submagic_templates_fetched", {
      count: cachedTemplates?.length ?? 0,
    });

    return NextResponse.json({ templates: cachedTemplates });
  } catch (e: any) {
    console.error("❌ Error fetching Submagic templates:", e);
    await gaServerEvent("submagic_templates_failed", {
      reason: e?.message || "internal_error",
    });
    return NextResponse.json(
      { error: "Error fetching templates" },
      { status: 500 }
    );
  }
}
