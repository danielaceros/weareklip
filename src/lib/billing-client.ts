// src/lib/billing-client.ts
import { auth } from "@/lib/firebase";
import { getIdToken } from "firebase/auth";

export type UsageKind = "script" | "voice" | "lipsync" | "edit";

// Pequeño envoltorio para llamar a tus APIs autenticado (sin any)
async function api<TResponse>(url: string, init: RequestInit = {}): Promise<TResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error("Debes iniciar sesión");

  const token = await getIdToken(user, true);
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(init.headers as HeadersInit),
  };

  const res = await fetch(url, { ...init, headers });

  // Intentamos parsear JSON
  let body: unknown = null;
  try {
    body = await res.json();
  } catch { /* puede venir sin cuerpo */ }

  if (!res.ok) {
    const msg =
      typeof body === "object" &&
      body !== null &&
      "error" in (body as Record<string, unknown>)
        ? String((body as { error?: unknown }).error)
        : `Error ${res.status}`;
    throw new Error(msg);
  }

  return body as TResponse;
}

/** 1) ¿Está listo el billing para dejarle continuar? */
type SummaryResponse = {
  subscription: { status: string | null; trialing: boolean } | null;
  trialCreditCents: number;
};
export async function ensureBillingReady(): Promise<boolean> {
  const s = await api<SummaryResponse>("/api/billing/summary");
  const status = s.subscription?.status ?? null; // null | "trialing" | "active" | ...
  if (!status) {
    // No tiene suscripción → iniciamos Checkout (trial)
    const data = await api<{ url: string }>("/api/billing/onboard", { method: "POST" });
    window.location.href = data.url;
    return false;
  }
  if (status === "trialing" && (s.trialCreditCents ?? 0) <= 0) {
    throw new Error("Tu crédito de prueba se ha agotado. Ve a Facturación para continuar.");
  }
  return true;
}

/** 2) Registrar consumo del producto */
type UsageAddResponse = {
  ok: boolean;
  kind: UsageKind;
  quantity: number;
  unitCents: number;
  creditedCents: number;
  chargedCents: number;
  currency: string;
  freeQty: number;
  paidQty: number;
  invoiceItemId: string | null;
};
export async function recordUsage(kind: UsageKind, quantity = 1): Promise<UsageAddResponse> {
  return api<UsageAddResponse>("/api/billing/usage", {
    method: "POST",
    body: JSON.stringify({ kind, quantity }),
  });
}

/** 3) (Dev) Forzar liquidación inmediata para pruebas (si tienes esa ruta) */
export async function settleNowDev(): Promise<void> {
  await api<{ ok: true }>("/api/billing/settle", { method: "POST" });
}

