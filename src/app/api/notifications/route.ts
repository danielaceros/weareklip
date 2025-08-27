import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB, adminTimestamp } from "@/lib/firebase-admin";

/** POST /api/notifications  Body: { token, platform?, userAgent? } */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.replace("Bearer ", "");
    if (!idToken) return NextResponse.json({ error: "No auth" }, { status: 401 });

    const { uid } = await adminAuth.verifyIdToken(idToken);
    const { token, platform = "web-android", userAgent = "" } = await req.json();
    if (!token) return NextResponse.json({ error: "No token" }, { status: 400 });

    await adminDB.collection("users").doc(uid).set({
      fcmTokens: {
        [token]: {
          active: true,
          platform,
          userAgent,
          createdAt: adminTimestamp.fromDate(new Date()),
        },
      },
    }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}
