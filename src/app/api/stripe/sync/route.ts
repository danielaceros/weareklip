// src/app/api/stripe/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminAuth, adminDB } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

type Body = {
  cursor?: string | null;
  limit?: number; // por página (1..50)
};

const ACTIVE = new Set(["active", "trialing", "past_due", "unpaid"]);
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 25;

export async function POST(req: NextRequest) {
  try {
    // ── 1) Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // ── 2) Rol admin ──────────────────────────────────────────────────────────
    const userSnap = await adminDB.collection("users").doc(uid).get();
    const isAdmin = userSnap.exists && userSnap.data()?.role === "admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── 3) Entrada (cursor + limit) ───────────────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as Body;
    const limit = Math.min(
      Math.max(Number.isFinite(body.limit as number) ? (body.limit as number) : DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const starting_after = body.cursor ?? undefined;

    // ── 4) Página de clientes Stripe ──────────────────────────────────────────
    const customers = await stripe.customers.list({
      limit,
      ...(starting_after ? { starting_after } : {}),
    });

    let processed = 0;
    const results: Array<{
      customerId: string;
      email: string | null;
      status: string | "none";
      mappedUid?: string;
    }> = [];

    // ── 5) Procesar clientes con suscripción “activa” ─────────────────────────
    for (const customer of customers.data) {
      const rawEmail = customer.email?.trim() ?? null;
      const lowerEmail = rawEmail ? rawEmail.toLowerCase() : null;

      // pido solo 1 suscripción; si no hay “activa-like”, salto
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all", // opcional: usa "active" para ser más estricto
        limit: 1,
      });

      const active = subs.data.find((s) => ACTIVE.has(s.status));
      if (!active) continue;

      let mappedUid: string | undefined;

      if (lowerEmail) {
        // 1) intenta por emailLower (case-insensitive)
        let matched = await adminDB
          .collection("users")
          .where("emailLower", "==", lowerEmail)
          .limit(1)
          .get();

        // 2) fallback por email exacto (por si aún no tienes emailLower poblado)
        if (matched.empty && rawEmail) {
          matched = await adminDB
            .collection("users")
            .where("email", "==", rawEmail)
            .limit(1)
            .get();
        }

        if (!matched.empty) {
          const userDoc = matched.docs[0];
          mappedUid = userDoc.id;

          // guarda la relación stripe<->usuario y normaliza emailLower para futuras búsquedas
          await userDoc.ref.set(
            {
              stripeCustomerId: customer.id,
              emailLower: lowerEmail,
              // opcional: sincronizar nombre si faltase
              name: userDoc.data().name ?? customer.name ?? "",
              updatedAt: Date.now(),
            },
            { merge: true }
          );
        } else {
          // guarda mapping para reconciliar después (no toques users/)
          await adminDB
            .collection("stripeCustomers")
            .doc(customer.id)
            .set(
              {
                customerId: customer.id,
                email: lowerEmail,
                name: customer.name ?? "",
                lastSeen: Date.now(),
                matchedUid: null,
              },
              { merge: true }
            );
        }
      } else {
        // sin email: registra mapping mínimo
        await adminDB
          .collection("stripeCustomers")
          .doc(customer.id)
          .set(
            {
              customerId: customer.id,
              email: null,
              name: customer.name ?? "",
              lastSeen: Date.now(),
              matchedUid: null,
            },
            { merge: true }
          );
      }

      results.push({
        customerId: customer.id,
        email: lowerEmail,
        status: active.status,
        mappedUid,
      });
      processed++;
    }

    const last = customers.data.at(-1);

    return NextResponse.json({
      ok: true,
      processed,
      pageSize: customers.data.length,
      hasMore: customers.has_more,
      cursor: last?.id ?? null,
      results,
    });
  } catch (error) {
    console.error("❌ Error en /api/stripe/sync:", error);
    return NextResponse.json({ error: "Error sincronizando clientes" }, { status: 500 });
  }
}

// Rechaza GET para evitar que se dispare sin querer desde el navegador
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
