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

/* ===== Tipos Firestore ===== */
type FireTimestamp = { seconds: number; nanoseconds: number };

interface SubscriptionInfo {
  id?: string | null;
  plan?: string | null;
  status?: string;
  active?: boolean;
  renewal?: FireTimestamp | null;
  lastUpdated?: FireTimestamp | null;
  lastPayment?: FireTimestamp | null;
}
interface UserDoc {
  stripeCustomerId?: string;
  subscription?: SubscriptionInfo;
  usage?: { tokens?: number; euros?: number }; // (opcional antiguo)
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
    renewalAt: number | null; // ms epoch
    daysLeft: number | null;
    trialing: boolean;
  };
  trialCreditCents: number;
  usage: { script: number; voice: number; lipsync: number; edit: number };
  pendingCents: number;
};

/* ===== Helpers UI ===== */
function tsToDate(ts?: FireTimestamp | null) {
  if (!ts?.seconds) return null;
  return new Date(ts.seconds * 1000);
}
function fmtDate(d: Date | null) {
  return d ? d.toLocaleDateString() : "-";
}

/* ===== Página ===== */
export default function BillingPage() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [docData, setDocData] = useState<UserDoc | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid).withConverter(userConverter);
    return onSnapshot(ref, (snap) => setDocData(snap.data() ?? null));
  }, [user]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const sub = docData?.subscription ?? null;
  const renewalDate = useMemo(() => tsToDate(sub?.renewal ?? null), [sub]);

  const statusLabel = useMemo(() => {
    if (!sub?.status) return "Sin suscripción";
    if (sub.status === "trialing") {
      const left = summary?.subscription.daysLeft ?? null;
      return `Prueba (${left ?? 0} días restantes)`;
    }
    if (sub.active) return "Activa";
    return sub.status;
  }, [sub, summary]);

  const onboard = async () => {
    if (!user) return alert("Inicia sesión");
    try {
      setRedirecting(true);
      const token = await getIdToken(user, true);
      const res = await fetch("/api/stripe/onboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.url)
        throw new Error(data.error ?? "No se pudo iniciar");
      window.location.href = data.url as string;
    } catch (e) {
      console.error(e);
      alert("No se pudo iniciar la prueba/suscripción");
      setRedirecting(false);
    }
  };

  // === Registrar uso contra /api/billing/usage ===
  const recordUsage = async (
    kind: "script" | "voice" | "lipsync" | "edit",
    q = 1
  ) => {
    if (!user) return;
    try {
      const token = await getIdToken(user, true);
      const res = await fetch("/api/billing/usage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ kind, quantity: q }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error || "Máximo alcanzado, continuar mañana");
      await loadSummary();
    } catch (err) {
      console.error(err);
      alert((err as Error).message);
    }
  };

  // === Liquidar ahora (sólo dev) ===
  const settleNowDev = async () => {
    if (!user) return;
    try {
      const token = await getIdToken(user, true);
      const res = await fetch("/api/billing/settle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          (data as { error?: string }).error || "No se pudo liquidar"
        );
      alert("Liquidación ejecutada (dev). Revisa Stripe.");
      await loadSummary();
    } catch (e) {
      console.error(e);
      alert((e as Error).message ?? "Error liquidando");
    }
  };

  const euro = (cents: number | undefined | null) =>
    (Math.max(0, cents ?? 0) / 100).toFixed(2);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold mb-6">Facturación / Suscripción</h1>

      {/* Bloque estado suscripción */}
      <div className="rounded-2xl border p-5 mb-8">
        <h2 className="font-semibold mb-2">Tu suscripción</h2>
        <p>Estado: {statusLabel}</p>
        <p>Plan: {sub?.plan ?? "-"}</p>
        <p>
          {sub?.status === "trialing" ? "Fin de prueba:" : "Renovación:"}{" "}
          {fmtDate(renewalDate)}
        </p>
        <p>Stripe status: {sub?.status ?? "-"}</p>
      </div>

      {/* Tarjeta de alta + Consumo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Plan Access */}
        <div className="rounded-2xl border p-5">
          <div className="text-lg font-medium">Access</div>
          <div className="text-2xl mt-1">29,99 €/mes</div>
          <div className="text-sm text-gray-500 mt-1">
            Acceso a la plataforma. Prueba de 7 días.
          </div>

          {sub?.status === "trialing" || sub?.active ? (
            <button
              disabled
              className="mt-4 w-full rounded-xl border px-4 py-2 opacity-60"
              title="Ya tienes una suscripción activa o en prueba"
            >
              Suscripción en curso
            </button>
          ) : (
            <button
              onClick={onboard}
              disabled={redirecting}
              className="mt-4 w-full rounded-xl border px-4 py-2 hover:bg-gray-50 disabled:opacity-60"
            >
              {redirecting ? "Redirigiendo…" : "Empezar prueba gratuita"}
            </button>
          )}
        </div>

        {/* Consumo / Crédito / Pendiente */}
        <div className="rounded-2xl border p-5 col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-lg font-medium">Consumo</div>
            <div className="flex items-center gap-2">
              {process.env.NODE_ENV === "development" && (
                <button
                  onClick={settleNowDev}
                  className="text-sm rounded-lg border px-3 py-1 hover:bg-gray-50"
                  title="Forzar liquidación inmediata (entorno de desarrollo)"
                >
                  Liquidar ahora (dev)
                </button>
              )}
              <button
                onClick={loadSummary}
                disabled={loadingSummary}
                className="text-sm rounded-lg border px-3 py-1 hover:bg-gray-50 disabled:opacity-60"
              >
                {loadingSummary ? "Actualizando…" : "Actualizar"}
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border p-3">
              <div className="text-xs text-gray-500">
                Crédito de prueba restante
              </div>
              <div className="text-xl mt-1">
                € {euro(summary?.trialCreditCents ?? 0)}
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <div className="text-xs text-gray-500">Pendiente a liquidar</div>
              <div className="text-xl mt-1">
                € {euro(summary?.pendingCents ?? 0)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                (se cobrará al final del periodo)
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <div className="text-xs text-gray-500">
                Operaciones (periodo actual)
              </div>
              <div className="mt-1 text-sm">
                Guiones: {summary?.usage.script ?? 0}
                {" · "}Voz: {summary?.usage.voice ?? 0}
                {" · "}LipSync: {summary?.usage.lipsync ?? 0}
                {" · "}Edición: {summary?.usage.edit ?? 0}
              </div>
            </div>
          </div>

          {/* Botonera de prueba de uso: sólo visible en development */}
          {process.env.NODE_ENV === "development" && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="rounded-lg border px-3 py-1"
                onClick={() => recordUsage("script")}
              >
                +1 Guión
              </button>
              <button
                className="rounded-lg border px-3 py-1"
                onClick={() => recordUsage("voice")}
              >
                +1 Voz
              </button>
              <button
                className="rounded-lg border px-3 py-1"
                onClick={() => recordUsage("lipsync")}
              >
                +1 LipSync
              </button>
              <button
                className="rounded-lg border px-3 py-1"
                onClick={() => recordUsage("edit")}
              >
                +1 Edición
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
