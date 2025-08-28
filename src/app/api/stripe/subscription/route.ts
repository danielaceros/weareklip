// src/app/api/stripe/customers/route.ts
import { stripe } from "@/lib/stripe";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { NextResponse } from "next/server";
import { gaServerEvent } from "@/lib/ga-server"; // 👈 añadido

export const dynamic = "force-dynamic";

type FirestoreUser = {
  uid: string;
  email: string;
  name?: string;
  createdAt?: number | null;
};

type Enriched = {
  uid: string;
  email: string;
  name: string;
  stripeId: string;
  stripeLink: string;
  subStatus: string;
  planName: string | null;
  createdAt: number | null;
};

type CustomersPayload = {
  data: Enriched[];
  hasMore: boolean;
  lastId: string | null;
};

type FirestoreUsersCache = {
  ts: number;
  map: Record<string, { uid: string; name?: string; createdAt?: number | null }>;
};

// 🧠 cachés en memoria
declare global {
  // eslint-disable-next-line no-var
  var __stripeCustomersCache:
    | Map<string, { ts: number; payload: CustomersPayload }>
    | undefined;
  // eslint-disable-next-line no-var
  var __firestoreUsersCache: FirestoreUsersCache | undefined;
  // eslint-disable-next-line no-var
  var __productNameCache:
    | Map<string, { ts: number; name: string | null }>
    | undefined;
}

const CACHE_TTL_MS = 60_000;
const WARN_CAP = 8;

const normalize = (str: string) => (str || "").trim().toLowerCase();

async function getProductName(productId: string): Promise<string | null> {
  const now = Date.now();
  const cache = (globalThis.__productNameCache ??= new Map<
    string,
    { ts: number; name: string | null }
  >());
  const hit = cache.get(productId);
  if (hit && now - hit.ts < CACHE_TTL_MS) return hit.name;

  try {
    const product = await stripe.products.retrieve(productId);
    const name = product?.name ?? null;
    cache.set(productId, { ts: now, name });
    return name;
  } catch {
    cache.set(productId, { ts: now, name: null });
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const starting_after = searchParams.get("starting_after") || undefined;
  const emailQuery = normalize(searchParams.get("email") || "");

  const cacheKey = JSON.stringify({ starting_after, emailQuery });
  const now = Date.now();

  const respCache =
    (globalThis.__stripeCustomersCache ??= new Map<
      string,
      { ts: number; payload: CustomersPayload }
    >());

  // 🔸 cache de respuesta final 60s
  const cached = respCache.get(cacheKey);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    await gaServerEvent("customers_cache_hit", { cacheKey });
    return NextResponse.json(cached.payload);
  }

  try {
    // 🔹 cache de usuarios de Firestore 60s
    let usersCache = globalThis.__firestoreUsersCache;
    if (!usersCache || now - usersCache.ts >= CACHE_TTL_MS) {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const res = await fetch("/api/firebase/users", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      const docs: any[] = await res.json();

      const map: Record<string, { uid: string; name?: string; createdAt?: number | null }> = {};
      docs.forEach((d) => {
        if (d?.email) {
          map[normalize(d.email)] = {
            uid: d.id,
            name: d.name,
            createdAt: d.createdAt ?? null,
          };
        }
      });

      usersCache = { ts: now, map };
      globalThis.__firestoreUsersCache = usersCache;
    }

    // 📥 pagina clientes de Stripe
    const customers = await stripe.customers.list({
      limit: 30,
      ...(starting_after && { starting_after }),
    });

    const unmatchedEmails: string[] = [];

    const enrichedPromises = customers.data.map(async (customer) => {
      const email = customer.email ?? "";
      if (!email) return null;
      if (emailQuery && !normalize(email).includes(emailQuery)) return null;

      const match = usersCache!.map[normalize(email)];
      if (!match) {
        unmatchedEmails.push(email);
        return null;
      }

      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: "active",
        limit: 1,
      });

      const active = subs.data[0];
      if (!active) return null;

      const firstItem = active.items.data[0];
      const price = firstItem?.price ?? null;

      let planName: string | null = null;
      if (price) {
        planName =
          price.nickname ??
          (typeof price.product === "string"
            ? await getProductName(price.product)
            : null);
      }

      const item: Enriched = {
        uid: match.uid,
        email,
        name: match.name || "",
        stripeId: customer.id,
        stripeLink: `https://dashboard.stripe.com/customers/${customer.id}`,
        subStatus: active.status,
        planName,
        createdAt: match.createdAt ?? null,
      };
      return item;
    });

    const enriched = (await Promise.all(enrichedPromises)).filter(
      (v): v is Enriched => Boolean(v)
    );
    const lastCustomer = customers.data[customers.data.length - 1];

    if (unmatchedEmails.length) {
      unmatchedEmails.slice(0, WARN_CAP).forEach((e) => {
        console.warn(`⚠️ No match Firebase para email Stripe: ${e}`);
      });
      const extra = unmatchedEmails.length - WARN_CAP;
      if (extra > 0) {
        console.warn(`(… y +${extra} más silenciados)`);
      }
      await gaServerEvent("customers_unmatched_emails", {
        count: unmatchedEmails.length,
        sample: unmatchedEmails.slice(0, WARN_CAP),
      });
    }

    const payload: CustomersPayload = {
      data: enriched,
      hasMore: customers.has_more,
      lastId: lastCustomer?.id || null,
    };

    respCache.set(cacheKey, { ts: now, payload });
    await gaServerEvent("customers_loaded", { count: enriched.length });
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error en /api/stripe/customers:", error);
    await gaServerEvent("customers_failed", { error: (error as Error).message });
    return NextResponse.json({ error: "Error cargando customers" }, { status: 500 });
  }
}
