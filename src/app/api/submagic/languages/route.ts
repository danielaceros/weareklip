import { NextResponse } from "next/server";

let cachedLanguages: { name: string; code: string }[] | null = null;
let lastFetch = 0;

export async function GET() {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  // Usar cache si no ha caducado
  if (cachedLanguages && now - lastFetch < oneDay) {
    return NextResponse.json({ languages: cachedLanguages });
  }

  const r = await fetch("https://api.submagic.co/v1/languages", {
    headers: { "x-api-key": process.env.SUBMAGIC_API_KEY! },
  });

  if (!r.ok) {
    return NextResponse.json(await r.json(), { status: r.status });
  }

  const data = await r.json();
  cachedLanguages = data.languages;
  lastFetch = now;

  return NextResponse.json({ languages: cachedLanguages });
}
