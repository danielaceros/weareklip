// /app/api/stripe/clients/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { gaServerEvent } from "@/lib/ga-server"; // 👈 añadido

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
  telemetry: false,
  maxNetworkRetries: 1,
  timeout: 20000,
});

/* ---------- helpers de tipos para evitar `any` ---------- */
type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
}
function getNum(o: UnknownRecord, key: string): number | null {
  const v = o[key];
  return typeof v === "number" ? v : null;
}

/** Lee start/end del periodo actual de forma compatible con distintas versiones de tipos */
function getCurrentPeriodMs(
  sub: Stripe.Subscription | UnknownRecord
): { startMs: number | null; endMs: number | null } {
  const obj: UnknownRecord = isRecord(sub) ? sub : {};
  let start = getNum(obj, "current_period_start");
  let end = getNum(obj, "current_period_end");

  // Alternativa: objeto current_period { start, end }
  const cp = obj["current_period"];
  if ((start == null || end == null) && isRecord(cp)) {
    if (start == null) start = getNum(cp, "start");
    if (end == null) end = getNum(cp, "end");
  }

  return {
    startMs: start != null ? start * 1000 : null,
    endMs: end != null ? end * 1000 : null,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startingAfter = searchParams.get("starting_after") || undefined;

  await gaServerEvent("clients_list_requested", { startingAfter }); // 👈 evento

  try {
    const customers = await stripe.customers.list({
      limit: 50,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    const rows = await Promise.all(
      customers.data.map(async (customer) => {
        const subs = await stripe.subscriptions.list({
          customer: customer.id,
          status: "all",
          limit: 5,
          expand: ["data.items.data.price"],
        });

        const active = subs.data.find((s) =>
          ["active", "trialing", "past_due", "unpaid"].includes(s.status)
        );
        if (!active) return null;

        const firstItem = active.items.data[0];
        const price = firstItem?.price as Stripe.Price | undefined;

        let planName: string | null = null;
        if (price?.nickname) {
          planName = price.nickname;
        } else if (price?.product) {
          const productId =
            typeof price.product === "string" ? price.product : price.product.id;
          try {
            const product = await stripe.products.retrieve(productId);
            planName = product?.name ?? null;
          } catch {
            planName = null;
          }
        }

        const { startMs: subStart, endMs: subEnd } = getCurrentPeriodMs(active);

        return {
          uid: customer.id,
          email: customer.email ?? "",
          name: customer.name ?? "",
          role: customer.metadata?.role ?? "",
          subStatus: active.status,
          planName,
          createdAt:
            typeof customer.created === "number" ? customer.created * 1000 : null,
          subStart,
          subEnd,
        };
      })
    );

    const data = rows.filter(
      (r): r is NonNullable<(typeof rows)[number]> => Boolean(r)
    );

    await gaServerEvent("clients_list_success", {
      count: data.length,
      hasMore: customers.has_more,
    }); // 👈 evento

    return NextResponse.json({
      data,
      lastId: customers.data.at(-1)?.id ?? null,
      hasMore: customers.has_more,
    });
  } catch (err) {
    console.error("Error Stripe API:", err);
    await gaServerEvent("clients_list_failed", { error: String(err) }); // 👈 evento
    return NextResponse.json(
      { data: [], error: "Internal server error" },
      { status: 500 }
    );
  }
}
