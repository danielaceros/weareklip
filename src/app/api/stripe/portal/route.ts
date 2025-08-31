// /api/stripe/portal/route.ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminAuth, adminDB } from "@/lib/firebase-admin";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const idToken = authHeader.split(" ")[1];
    const decoded = await adminAuth.verifyIdToken(idToken);

    // 🔹 buscar el customerId en Firestore
    const snap = await adminDB.collection("users").doc(decoded.uid).get();
    const customerId = snap.data()?.stripeCustomerId;
    if (!customerId) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // 🔹 crear sesión del portal
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${APP_URL}/dashboard`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("❌ Error creando portal:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
