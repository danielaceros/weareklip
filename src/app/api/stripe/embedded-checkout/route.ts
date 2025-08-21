// /app/api/stripe/embedded-checkout/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminAuth, adminDB } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const idToken = auth?.startsWith("Bearer ") ? auth.split(" ")[1] : undefined;
  if (!idToken) return NextResponse.json({ error: "No auth" }, { status: 401 });
  const decoded = await adminAuth.verifyIdToken(idToken);

  const userSnap = await adminDB.collection("users").doc(decoded.uid).get();
  const user = userSnap.data() || {};
  const customerId: string | undefined = user.stripeCustomerId;
  if (!customerId) {
    return NextResponse.json({ error: "Customer no creado aún" }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    ui_mode: "embedded",
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ACCESS!, quantity: 1 }],
    subscription_data: { metadata: { plan: "access", uid: decoded.uid } },
    // IMPORTANTE para embedded:
    redirect_on_completion: "never",
    // (Opcional) return_url si decides permitir redirecciones manuales en algún caso
    // return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/facturacion`,
  });

  return NextResponse.json({ clientSecret: session.client_secret });
}
