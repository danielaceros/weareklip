// src/app/api/billing/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB, adminTimestamp } from "@/lib/firebase-admin";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UsageKind = "script" | "voice" | "lipsync" | "edit";
type FireTimestamp = { seconds: number; nanoseconds: number };

interface SubscriptionInfo {
  status?: string | null;
  active?: boolean;
  plan?: string | null;
  renewal?: FireTimestamp | null;
  id?: string | null;
  lastUpdated?: FireTimestamp | null;
  lastPayment?: FireTimestamp | null;
}
interface UserDoc {
  stripeCustomerId?: string;
  subscription?: SubscriptionInfo;
  trialCreditCents?: number;
  usage?: Partial<Record<UsageKind, number>>;
  pendingLocalCents?: number;
  pendingLocalResetAt?: FireTimestamp | null;
}

function daysLeftFrom(ts?: FireTimestamp | null): number | null {
  if (!ts?.seconds) return null;
  const ms = ts.seconds * 1000 - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
function safeNumber(n: unknown, fallback = 0): number {
  return typeof n === "number" && isFinite(n) ? n : fallback;
}

/** Wrapper para invoices.retrieveUpcoming con expand de líneas/precio */
type RetrieveUpcomingFn = (p: { customer: string; expand?: string[] }) => Promise<unknown>;
function getRetrieveUpcoming(): RetrieveUpcomingFn {
  const inv = stripe.invoices as unknown as { retrieveUpcoming?: RetrieveUpcomingFn };
  if (!inv.retrieveUpcoming) {
    throw new Error("Tu versión de stripe-node no expone invoices.retrieveUpcoming en tipos. Actualiza stripe.");
  }
  return inv.retrieveUpcoming.bind(stripe.invoices);
}

const DEFAULT_TRIAL_CENTS = Number(process.env.TRIAL_CREDIT_CENTS ?? "1500");

export async function GET(req: NextRequest) {
  try {
    // 1) Auth
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;
    if (!idToken) return NextResponse.json({ error: "Missing ID token" }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // 2) User
    const userRef = adminDB.collection("users").doc(uid);
    const snap = await userRef.get();
    const user: UserDoc = snap.exists ? ((snap.data() as unknown) as UserDoc) : {};

    const sub = user.subscription ?? {};
    const customerId = user.stripeCustomerId;

    // 3) Info suscripción
    const renewalAtMs =
      sub.renewal?.seconds && Number.isFinite(sub.renewal.seconds) ? sub.renewal.seconds * 1000 : null;
    const trialing = sub.status === "trialing";
    const daysLeft = trialing ? daysLeftFrom(sub.renewal ?? null) : null;

    // 4) Contadores locales
    const usage: Record<UsageKind, number> = {
      script: safeNumber(user.usage?.script),
      voice: safeNumber(user.usage?.voice),
      lipsync: safeNumber(user.usage?.lipsync),
      edit: safeNumber(user.usage?.edit),
    };

    // 4.1) Inicializar crédito si está en trial
    let trialCreditCents =
      typeof user.trialCreditCents === "number" ? user.trialCreditCents : null;
    if (trialing && (trialCreditCents === null || trialCreditCents === undefined)) {
      trialCreditCents = DEFAULT_TRIAL_CENTS;
      await userRef.set({ trialCreditCents, lastUpdated: adminTimestamp.now() }, { merge: true });
    }

    // 5) Pendiente en próxima factura (sumar SOLO líneas metered)
    let pendingCentsStripe = 0;
    if (customerId) {
      try {
        const retrieveUpcoming = getRetrieveUpcoming();
        const upcoming = await retrieveUpcoming({
          customer: customerId,
          expand: ["lines.data.price"],
        });

        type Recurring = { usage_type?: unknown } | null | undefined;
        type Price = { recurring?: Recurring } | null | undefined;
        type Line = { amount?: unknown; price?: Price } | null | undefined;
        type UpcomingShape = { lines?: { data?: Line[] } } | null | undefined;

        const up = (upcoming as UpcomingShape) ?? {};
        const lines = Array.isArray(up.lines?.data) ? up.lines!.data! : [];

        for (const line of lines) {
          const amt = safeNumber(line?.amount, 0);
          const usageType = (line?.price?.recurring as { usage_type?: string } | null | undefined)?.usage_type;
          if (usageType === "metered") pendingCentsStripe += amt;
        }
        if (pendingCentsStripe < 0) pendingCentsStripe = 0;
      } catch {
        /* sin upcoming, ignoramos */
      }
    }

    // 6) Fallback local si Stripe aún no ha agregado los eventos recientes
    const pendingCentsLocal = safeNumber(user.pendingLocalCents);
    const pendingCents = Math.max(pendingCentsStripe, pendingCentsLocal);

    // 7) Respuesta
    return NextResponse.json(
      {
        subscription: {
          status: sub.status ?? null,
          active: Boolean(sub.active),
          plan: sub.plan ?? null,
          renewalAt: renewalAtMs,
          daysLeft,
          trialing,
        },
        trialCreditCents: safeNumber(trialCreditCents),
        usage,
        pendingCents,          // ← la UI puede seguir usando este campo
        // opcionalmente, te devuelvo también ambos para depurar
        debug: {
          pendingCentsStripe,
          pendingCentsLocal,
        },
      },
      { status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "summary error";
    console.error("❌ /api/billing/summary:", msg, e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
