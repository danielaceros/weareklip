// src/app/api/session/route.ts
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Valida token
    const decoded = await adminAuth.verifyIdToken(idToken);

    // 🔑 Crea cookie de sesión (válida p.ej. 5 días)
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 días en ms
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    const res = NextResponse.json({ ok: true });
    res.cookies.set("authToken", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: expiresIn / 1000, // en segundos
      sameSite: "strict",
    });

    return res;
  } catch (err) {
    console.error("Error creando sesión:", err);
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("authToken", "", { path: "/", maxAge: 0 });
  return res;
}
