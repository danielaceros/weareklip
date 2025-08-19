import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDB, adminTimestamp } from "@/lib/firebase-admin";
import { stripe } from "@/lib/stripe";

/* ========= Config ========= */
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
}

/* ========= Helpers ========= */

function daysLeftFrom(ts?: FireTimestamp | null): number | null {
  if (!ts?.seconds) return null;
  const ms = ts.seconds * 1000 - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function safeNumber(n: unknown, fallback = 0): number {
  return typeof n === "number" && isFinite(n) ? n : fallback;
}

/** Wrapper para evitar `any` si tu versión de stripe-node no tipa retrieveUpcoming */
type RetrieveUpcomingFn = (p: { customer: string }) => Promise<unknown>;
function getRetrieveUpcoming(): RetrieveUpcomingFn {
  const inv = stripe.invoices as unknown as { retrieveUpcoming?: RetrieveUpcomingFn };
  if (!inv.retrieveUpcoming) {
    throw new Error(
      "Tu versión de stripe-node no expone `invoices.retrieveUpcoming` en tipos. Actualiza `stripe`."
    );
  }
  return inv.retrieveUpcoming.bind(stripe.invoices);
}

const DEFAULT_TRIAL_CENTS = Number(process.env.TRIAL_CREDIT_CENTS ?? "500");

/* ========= Handler ========= */

export async function GET(req: NextRequest) {
  try {
    // 1) Auth
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;

    if (!idToken) {
      return NextResponse.json({ error: "Missing ID token" }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // 2) Cargar doc de usuario
    const userRef = adminDB.collection("users").doc(uid);
    const snap = await userRef.get();
    const user: UserDoc = snap.exists ? ((snap.data() as unknown) as UserDoc) : {};

    const sub = user.subscription ?? {};
    const customerId = user.stripeCustomerId;

    // 3) Info de suscripción (para el front)
    const renewalAtMs =
      sub.renewal?.seconds && Number.isFinite(sub.renewal.seconds)
        ? sub.renewal.seconds * 1000
        : null;

    const trialing = sub.status === "trialing";
    const daysLeft = trialing ? daysLeftFrom(sub.renewal ?? null) : null;

    // 4) Contadores locales
    const usage: Record<UsageKind, number> = {
      script: safeNumber(user.usage?.script),
      voice: safeNumber(user.usage?.voice),
      lipsync: safeNumber(user.usage?.lipsync),
      edit: safeNumber(user.usage?.edit),
    };

    // 4.1) Inicializar crédito si está en trial y aún no existe
    let trialCreditCents =
      typeof user.trialCreditCents === "number"
        ? user.trialCreditCents
        : null;

    if (trialing && (trialCreditCents === null || trialCreditCents === undefined)) {
      trialCreditCents = DEFAULT_TRIAL_CENTS;
      await userRef.set(
        { trialCreditCents, lastUpdated: adminTimestamp.now() },
        { merge: true }
      );
    }

    // 5) € acumulados pendientes en Stripe (próxima factura)
    let pendingCents = 0;

    if (customerId) {
      try {
        const retrieveUpcoming = getRetrieveUpcoming();
        const upcoming = await retrieveUpcoming({ customer: customerId });

        type Line = { description?: unknown; amount?: unknown };
        type UpcomingShape = { lines?: { data?: Line[] } };

        const up = (upcoming as UpcomingShape) ?? {};
        const lines = Array.isArray(up.lines?.data) ? up.lines!.data! : [];

        for (const line of lines) {
          const desc = typeof line.description === "string" ? line.description : "";
          const amt = safeNumber(line.amount, 0);
          if (desc.startsWith("usage:")) pendingCents += amt;
        }

        if (pendingCents < 0) pendingCents = 0;
      } catch {
        /* sin upcoming, ignoramos */
      }
    }

    // 6) Respuesta
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
        pendingCents,
      },
      { status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "summary error";
    console.error("❌ /api/billing/summary:", msg, e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
