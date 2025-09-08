// src/lib/db.ts
import { adminAuth, adminDB } from "./firebase-admin";

const USERS = "users";

export type AppUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  stripeCustomerId?: string | null;
};

function parseCookies(h: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  h.split(";").forEach((p) => {
    const [k, ...v] = p.trim().split("=");
    out[k] = decodeURIComponent(v.join("="));
  });
  return out;
}

async function getUserDoc(uid: string, fallbackEmail: string | null): Promise<AppUser> {
  const ref = adminDB.collection(USERS).doc(uid);
  const snap = await ref.get();
  const data = snap.exists ? (snap.data() as any) : {};
  return {
    id: uid,
    email: data.email ?? fallbackEmail ?? null,
    name: data.name ?? null,
    stripeCustomerId: data.stripeCustomerId ?? null,
  };
}

/** Obtiene el usuario autenticado: cookie `session` o `Authorization: Bearer` */
export async function getUserFromSession(req: Request): Promise<AppUser> {
  // 1) Session cookie
  const cookies = parseCookies(req.headers.get("cookie"));
  const sessionCookie = cookies["session"] || cookies["__session"];
  if (sessionCookie) {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return getUserDoc(decoded.uid, (decoded as any).email ?? null);
  }

  // 2) Bearer token
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const idToken = auth.slice(7);
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    return getUserDoc(decoded.uid, (decoded as any).email ?? null);
  }

  throw new Error("Unauthorized");
}

export async function saveStripeCustomerId(userId: string, customerId: string) {
  await adminDB.collection(USERS).doc(userId).set({ stripeCustomerId: customerId }, { merge: true });
}

export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const snap = await adminDB.collection(USERS).doc(userId).get();
  return (snap.exists && (snap.data() as any)?.stripeCustomerId) || null;
}

/** Busca el userId a partir de un customerId (para el webhook) */
export async function findUserIdByCustomerId(customerId: string): Promise<string | null> {
  const q = await adminDB.collection(USERS).where("stripeCustomerId", "==", customerId).limit(1).get();
  if (q.empty) return null;
  return q.docs[0].id;
}

/** Actualiza el bloque `subscription` en el doc del usuario */
export async function upsertUserSubscription(userId: string, payload: any) {
  await adminDB.collection(USERS).doc(userId).set({ subscription: payload }, { merge: true });
}

/** Marca último pago / flags útiles */
export async function markLastPayment(userId: string, isoDate: string) {
  await adminDB.collection(USERS).doc(userId).set({ lastPayment: isoDate }, { merge: true });
}
