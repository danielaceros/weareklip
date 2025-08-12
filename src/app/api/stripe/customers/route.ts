// src/app/api/stripe/customers/route.ts
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { NextResponse } from "next/server";
import Stripe from "stripe";

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

// 🧠 cachés en memoria (útiles en dev y en server persistente)
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
  // eslint-disable-next-line no-var
  var __warnedEmails: Set<string> | undefined;
}

const CACHE_TTL_MS = 60_000;

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

// 🔎 helpers tipadas para evitar any
function getProductIdFromPrice(price: Stripe.Price | null | undefined): string | null {
  if (!price || !price.product) return null;
  return typeof price.product === "string" ? price.product : price.product.id;
}

async function getPlanNameFromPrice(price: Stripe.Price | null | undefined): Promise<string | null> {
  if (!price) return null;
  if (price.nickname) return price.nickname; // 1) usa nickname si lo tienes definido
  const productId = getProductIdFromPrice(price); // 2) si no, resuelve productId y usa caché
  if (!productId) return null;
  return await getProductName(productId);
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
    return NextResponse.json(cached.payload);
  }

  try {
    // 🔹 cache de usuarios de Firestore 60s
    let usersCache = globalThis.__firestoreUsersCache;
    if (!usersCache || now - usersCache.ts >= CACHE_TTL_MS) {
      const snap = await getDocs(collection(db, "users"));
      const map: Record<string, { uid: string; name?: string; createdAt?: number | null }> = {};
      snap.forEach((doc) => {
        const d = doc.data() as FirestoreUser;
        if (d?.email) {
          map[normalize(d.email)] = {
            uid: doc.id,
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

    const warned = (globalThis.__warnedEmails ??= new Set<string>());

    const enrichedPromises = customers.data.map(async (customer) => {
      const email = customer.email ?? "";
      if (!email) return null;
      if (emailQuery && !normalize(email).includes(emailQuery)) return null;

      const match = usersCache!.map[normalize(email)];
      if (!match) {
        // loggea cada email "sin match" solo una vez por proceso
        if (!warned.has(email)) {
          warned.add(email);
          console.warn(`⚠️ No match Firebase para email Stripe: ${email}`);
        }
        return null;
      }

      // 🔻 solo suscripción ACTIVA y expande SOLO el price (no el product)
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: "active",
        limit: 1,
        expand: ["data.items.data.price"],
      });

      const active = subs.data[0];
      if (!active) return null;

      const firstItem = active.items.data[0];
      const price = (firstItem?.price as Stripe.Price | null | undefined);

      const item: Enriched = {
        uid: match.uid,
        email,
        name: match.name || "",
        stripeId: customer.id,
        stripeLink: `https://dashboard.stripe.com/customers/${customer.id}`,
        subStatus: active.status,
        planName: await getPlanNameFromPrice(price),
        createdAt: match.createdAt ?? null,
      };
      return item;
    });

    const enriched = (await Promise.all(enrichedPromises)).filter(
      (v): v is Enriched => Boolean(v)
    );
    const lastCustomer = customers.data[customers.data.length - 1];

    const payload: CustomersPayload = {
      data: enriched,
      hasMore: customers.has_more,
      lastId: lastCustomer?.id || null,
    };

    respCache.set(cacheKey, { ts: now, payload });
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error en /api/stripe/customers:", error);
    return NextResponse.json({ error: "Error cargando customers" }, { status: 500 });
  }
}
