// app/api/submagic/templates/route.ts
import { NextResponse } from "next/server";

let cachedTemplates: string[] | null = null;
let lastFetch = 0;

export async function GET() {
  const now = Date.now();
  const sixHours = 6 * 60 * 60 * 1000;

  if (cachedTemplates && now - lastFetch < sixHours) {
    return NextResponse.json({ templates: cachedTemplates });
  }

  const r = await fetch("https://api.submagic.co/v1/templates", {
    headers: { "x-api-key": process.env.SUBMAGIC_API_KEY! },
  });

  if (!r.ok) {
    return NextResponse.json(await r.json(), { status: r.status });
  }

  const data = await r.json();
  cachedTemplates = data.templates;
  lastFetch = now;

  return NextResponse.json({ templates: cachedTemplates });
}
