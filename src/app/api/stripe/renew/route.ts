import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDB } from "@/lib/firebase-admin";
import { gaServerEvent } from "@/lib/ga-server"; // 👈 añadido

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

export async function POST(req: NextRequest) {
  try {
    const { uid } = await req.json();
    if (!uid) {
      await gaServerEvent("renew_missing_uid", {});
      return NextResponse.json({ error: "Falta uid" }, { status: 400 });
    }

    // 1) Buscar el user en Firestore
    const userRef = adminDB.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      await gaServerEvent("renew_user_not_found", { uid });
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const data = snap.data()!;
    const customerId = data.stripeCustomerId;
    const trialUsed = Boolean(data?.trialUsed);

    if (!customerId) {
      await gaServerEvent("renew_no_customerId", { uid });
      return NextResponse.json({ error: "Usuario sin Stripe customerId" }, { status: 400 });
    }

    // 2) Buscar suscripciones de ese customer
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 1,
    });
    const subscription = subs.data[0];

    // 3) Caso A: activa pero marcada para cancelación → reactivar
    if (subscription?.cancel_at_period_end) {
      if (subscription.status === "trialing" && trialUsed) {
        await stripe.subscriptions.cancel(subscription.id);
        const newSub = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: process.env.STRIPE_PRICE_ACCESS! }],
          trial_period_days: 0,
        });
        await gaServerEvent("renew_created_no_trial", { uid, customerId });
        return NextResponse.json({ subscription: newSub, action: "created_no_trial" });
      }

      const updated = await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: false,
      });
      await gaServerEvent("renew_reactivated", { uid, customerId, subscriptionId: subscription.id });
      return NextResponse.json({ subscription: updated, action: "reactivated" });
    }

    // 4) Caso B: cancelada totalmente → crear nueva
    if (!subscription || subscription.status === "canceled") {
      if (!process.env.STRIPE_PRICE_ACCESS) {
        return NextResponse.json({ error: "Falta STRIPE_PRICE_ACCESS en env" }, { status: 500 });
      }

      let allowTrial = !trialUsed;
      if (allowTrial) {
        await userRef.set({ trialUsed: true }, { merge: true });
      }

      const newSub = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: process.env.STRIPE_PRICE_ACCESS }],
        trial_period_days: allowTrial ? 7 : 0,
      });

      await gaServerEvent(
        allowTrial ? "renew_created_with_trial" : "renew_created_no_trial",
        { uid, customerId, subscriptionId: newSub.id }
      );

      return NextResponse.json({
        subscription: newSub,
        action: allowTrial ? "created_with_trial" : "created_no_trial",
      });
    }

    // 5) Caso C: está trialing pero usuario ya usó trial → forzar nueva sin trial
    if (subscription.status === "trialing" && trialUsed) {
      await stripe.subscriptions.cancel(subscription.id);
      const newSub = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: process.env.STRIPE_PRICE_ACCESS! }],
        trial_period_days: 0,
      });
      await gaServerEvent("renew_created_no_trial", { uid, customerId, subscriptionId: newSub.id });
      return NextResponse.json({ subscription: newSub, action: "created_no_trial" });
    }

    // 6) Ya activa → nada que hacer
    await gaServerEvent("renew_already_active", { uid, customerId, subscriptionId: subscription?.id });
    return NextResponse.json(
      { error: "La suscripción ya está activa, no es necesario renovarla." },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Error renewing subscription:", err);
    await gaServerEvent("renew_failed", { error: err.message });
    return NextResponse.json(
      { error: err.message ?? "Error interno" },
      { status: 500 }
    );
  }
}
