import { NextResponse } from "next/server";

const ALLOWED = new Set(["es", "en", "fr"]);

export async function POST(req: Request) {
  const url = new URL(req.url);
  let locale = url.searchParams.get("locale");

  if (!locale) {
    const body = await req.json().catch(() => null);
    locale = body?.locale;
  }

  if (!locale || !ALLOWED.has(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, locale });

  // Cookie que lee tu RootLayout
  res.cookies.set("NEXT_LOCALE", locale, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 año
  });

  return res;
}
