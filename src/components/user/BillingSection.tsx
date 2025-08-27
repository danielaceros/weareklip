"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, getIdToken, type User } from "firebase/auth";
import {
  doc,
  onSnapshot,
  type FirestoreDataConverter,
  type DocumentData,
} from "firebase/firestore";
import EmbeddedCheckoutModal from "@/components/user/EmbeddedCheckoutModal";
import { Badge } from "@/components/ui/badge";

/* ===== Tipos Firestore ===== */
type FireTimestamp = { seconds: number; nanoseconds: number };

export interface SubscriptionInfo {
  id?: string | null;
  plan?: string | null;
  status?: string;
  active?: boolean;
  renewal?: Date | null;
  lastUpdated?: Date | null;
  lastPayment?: Date | null;
  trial_start?: Date | null;
  trial_end?: Date | null;
  amount?: number | null;
  currency?: string | null;
  start_date?: Date | null;
  cancel_at_period_end?: boolean;
  canceled_at?: Date | null;
  customerId?: string | null;
  raw?: any;
}

interface UserDoc {
  stripeCustomerId?: string;
  subscription?: SubscriptionInfo;
  usage?: { tokens?: number; euros?: number };
}
const userConverter: FirestoreDataConverter<UserDoc> = {
  toFirestore: (data: UserDoc) => data as DocumentData,
  fromFirestore: (snap, options) => snap.data(options) as UserDoc,
};

/* ===== Tipos del summary API ===== */
type Summary = {
  subscription: {
    status: string | null;
    active: boolean;
    plan: string | null;
    renewalAt: number | null;
    daysLeft: number | null;
    trialing: boolean;
    cancelAtPeriodEnd?: boolean;
  };
  trialCreditCents: number;
  usage: { script: number; voice: number; lipsync: number; edit: number };
  pendingCents: number;
  overdueCents?: number;
  hasOverdue?: boolean;
};

/* ===== Helpers UI ===== */
function tsToDate(ts?: FireTimestamp | null) {
  if (!ts?.seconds) return null;
  return new Date(ts.seconds * 1000);
}
function fmtDate(d: Date | null) {
  return d ? d.toLocaleDateString() : "-";
}
const euro = (cents: number | undefined | null) =>
  (Math.max(0, cents ?? 0) / 100).toFixed(2);

function statusBadge(status: string | null, cancelAtPeriodEnd?: boolean) {
  if (!status) return <Badge variant="secondary">Sin suscripción</Badge>;

  if (status === "trialing")
    return <Badge variant="secondary">En prueba</Badge>;

  if (status === "active" && cancelAtPeriodEnd)
    return <Badge variant="outline">Cancelada al final del periodo</Badge>;

  if (status === "active") return <Badge variant="default">Activa</Badge>;
  if (status === "past_due")
    return <Badge variant="destructive">Pago vencido</Badge>;
  if (status === "unpaid")
    return <Badge variant="destructive">Impago</Badge>;
  if (status === "canceled")
    return <Badge variant="outline">Cancelada</Badge>;

  return <Badge variant="secondary">{status}</Badge>;
}

/* ===== Componente ===== */
export default function BillingSection() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [docData, setDocData] = useState<UserDoc | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [stripeData, setStripeData] = useState<any | null>(null);
  const [loadingStripe, setLoadingStripe] = useState(false);
  const [openCheckout, setOpenCheckout] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Firestore listener
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid).withConverter(userConverter);
    return onSnapshot(ref, (snap) => setDocData(snap.data() ?? null));
  }, [user]);

  // Consulta Stripe por email
  useEffect(() => {
    if (!user?.email) return;
    const fetchStripe = async () => {
      setLoadingStripe(true);
      try {
        const res = await fetch(`/api/stripe/email?email=${encodeURIComponent(user.email!)}`);
        const data = await res.json();
        if (!res.ok) {
          console.warn("Stripe: ", data.error);
          setStripeData(null);
          return;
        }
        setStripeData(data);
      } catch (err) {
        console.error("Stripe fetch error:", err);
        setStripeData(null);
      } finally {
        setLoadingStripe(false);
      }
    };
    fetchStripe();
  }, [user?.email]);

  // Cargar /api/billing/summary
  const loadSummary = async () => {
    if (!user) return;
    setLoadingSummary(true);
    try {
      const token = await getIdToken(user, true);
      const res = await fetch("/api/billing/summary", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as Summary & { error?: string };
      if (!res.ok) throw new Error(data.error || "Error summary");
      setSummary(data);
    } catch (e) {
      console.error(e);
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    if (user) loadSummary();
  }, [user]);

  // 🔹 Solo mostrar subscripción mensual (Access)
  const sub = stripeData
    ? {
        plan: stripeData.plan,
        status: stripeData.status,
        active: stripeData.status === "active" || stripeData.status === "trialing",
        renewal: stripeData.end_date ? new Date(stripeData.end_date) : null,
        trial_start: stripeData.trial_start ? new Date(stripeData.trial_start * 1000) : null,
        trial_end: stripeData.trial_end ? new Date(stripeData.trial_end * 1000) : null,
        cancel_at_period_end: stripeData.cancel_at_period_end ?? false,
      }
    : docData?.subscription ?? null;
  return (
    <section className="border rounded-lg p-6 bg-card text-card-foreground shadow-sm">
      <h2 className="text-xl font-semibold mb-4">💳 Facturación / Suscripción</h2>

      {loadingStripe && (
        <p className="text-sm text-muted-foreground mb-2">
          Consultando suscripción en Stripe…
        </p>
      )}

      <div className="rounded-xl border p-4 mb-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Estado:</span>
          {statusBadge(sub?.status ?? null, sub?.cancel_at_period_end)}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Plan:</span>
          <Badge variant="outline">{sub?.plan ?? "Access"}</Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {sub?.status === "trialing" ? "Fin de prueba:" : "Renovación:"}
          </span>
          <Badge variant="secondary">
            {sub?.status === "trialing"
              ? fmtDate(sub?.trial_end ?? null)
              : fmtDate(sub?.renewal ?? null)}
          </Badge>
        </div>
      </div>
            
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border p-4">
          <div className="text-lg font-medium">Access</div>
          <div className="text-2xl mt-1">29,99 €/mes</div>
          <div className="text-sm text-muted-foreground mt-1">
            Acceso a la plataforma. Prueba de 7 días.
          </div>

          {sub?.status === "trialing" || sub?.active ? (
            <>
              <button
                disabled
                className="mt-4 w-full rounded-xl border px-4 py-2 opacity-60"
              >
                Suscripción en curso
              </button>

              <a
                href={process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 w-full block rounded-xl border px-4 py-2 text-center hover:bg-accent"
              >
                Gestionar suscripción
              </a>
            </>
          ) : (
            <button
              onClick={() => setOpenCheckout(true)}
              className="mt-4 w-full rounded-xl border px-4 py-2 hover:bg-accent disabled:opacity-60"
            >
              Empezar prueba gratuita
            </button>
          )}
        </div>

        <div className="rounded-xl border p-4 col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-lg font-medium">Consumo</span>
            <button
              onClick={loadSummary}
              disabled={loadingSummary}
              className="text-sm rounded-lg border px-3 py-1 hover:bg-accent disabled:opacity-60"
            >
              {loadingSummary ? "Actualizando…" : "Actualizar"}
            </button>
          </div>

          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border p-3">
              <div className="text-xs text-muted-foreground">Crédito de prueba restante</div>
              <div className="text-xl mt-1">€ {euro(summary?.trialCreditCents ?? 0)}</div>
            </div>

            {/* Mostrar deuda vencida en rojo si existe */}
            {summary?.hasOverdue ? (
              <div className="rounded-xl border p-3 bg-red-50">
                <div className="text-xs text-red-600 font-medium">Deuda vencida</div>
                <div className="text-xl mt-1 text-red-600">
                  € {euro(summary?.overdueCents ?? 0)}
                </div>
                <a
                  href={process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block rounded-xl border px-3 py-1 text-center text-red-600 border-red-300 hover:bg-red-100"
                >
                  Pagar ahora
                </a>
              </div>
            ) : (
              <div className="rounded-xl border p-3">
                <div className="text-xs text-muted-foreground">Pendiente a liquidar</div>
                <div className="text-xl mt-1">€ {euro(summary?.pendingCents ?? 0)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  (se cobrará al final del periodo)
                </div>
              </div>
            )}

            <div className="rounded-xl border p-3">
              <div className="text-xs text-muted-foreground">Operaciones (periodo actual)</div>
              <div className="mt-1 text-sm">
                Guiones: {summary?.usage.script ?? 0} · Voz: {summary?.usage.voice ?? 0} ·{" "}
                LipSync: {summary?.usage.lipsync ?? 0} · Edición: {summary?.usage.edit ?? 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Stripe Embedded */}
      {user?.email && (
        <EmbeddedCheckoutModal
          open={openCheckout}
          uid={user.uid}
          onClose={() => setOpenCheckout(false)}
        />
      )}
    </section>
  );
}
