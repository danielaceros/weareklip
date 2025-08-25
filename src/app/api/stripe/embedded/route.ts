import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDB } from "@/lib/firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

export async function POST(req: NextRequest) {
  try {
    const { uid } = await req.json();
    if (!uid) {
      return NextResponse.json({ error: "Falta uid" }, { status: 400 });
    }

    // 1) Buscar usuario en Firestore
    const userRef = adminDB.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "Usuario no encontrado en Firestore" },
        { status: 404 }
      );
    }

    const data = snap.data() || {};
    let customerId: string | undefined = data.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { uid },
      });
      customerId = customer.id;
      await userRef.set({ stripeCustomerId: customerId }, { merge: true });
    }

    // 2) Control de trial → solo si nunca lo usó
    let trialDays = 7;
    if (data.trialUsed) {
      trialDays = 0;
    } else {
      await userRef.set({ trialUsed: true }, { merge: true });
    }

    // 3) Crear payload de suscripción dinámico
    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {};
    if (trialDays > 0) {
      subscriptionData.trial_period_days = trialDays;
    }

    // 4) Crear sesión embebida
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      customer: customerId,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ACCESS!,
          quantity: 1,
        },
      ],
      mode: "subscription",
      subscription_data: subscriptionData,
      payment_method_collection: "always",
      payment_method_types: ["card"],
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    });

    return NextResponse.json({ client_secret: session.client_secret });
  } catch (err: any) {
    console.error("❌ Error creating embedded checkout session:", err);
    return NextResponse.json(
      { error: err.message ?? "Error interno" },
      { status: 500 }
    );
  }
}
