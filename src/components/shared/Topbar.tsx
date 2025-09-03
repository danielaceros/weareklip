"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { getIdToken } from "firebase/auth";
import UserDropdown from "@/components/layout/UserDropdown";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import CreateReelGlobalButton from "@/components/wizard/CreateReelGlobalButton";
import { Gift } from "lucide-react";

type Summary = {
  subscriptions: {
    monthly: {
      id: string | null;
      status: string | null;
      active: boolean;
      plan: string | null;
      renewalAt: number | null;
      trialing: boolean;
      cancelAtPeriodEnd: boolean;
    } | null;
    usage: {
      id: string | null;
      status: string | null;
      active: boolean;
      plan: string | null;
      renewalAt: number | null;
      trialing: boolean;
      cancelAtPeriodEnd: boolean;
    } | null;
  };
  usage: { script: number; voice: number; lipsync: number; edit: number };
  pendingUsageCents: number;
  credits: { availableCents: number; currency: string | null };
  payment: { hasDefaultPayment: boolean };
  hasOverdue: boolean;
  overdueCents: number;
  trial?: { available: boolean; used: boolean };
  debug: { customerId: string | null; reconciled: boolean };
};

export function Topbar() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(setUser);
    return () => unsub();
  }, []);

  const loadSummary = async (force = false) => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getIdToken(user, force);
      const res = await fetch("/api/billing/summary", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSummary(data);
      } else {
        console.error("Summary error:", data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary(true);
  }, [user]);

  // 🧮 Conversiones
  const toCredits = (cents?: number | null) =>
    Math.floor(Math.max(0, cents ?? 0) / 10);
  const availableCredits = toCredits(summary?.credits?.availableCents);
  const pendingCredits = toCredits(summary?.pendingUsageCents);
  const overdueCredits = toCredits(summary?.overdueCents);

  // 🔁 Fechas de ciclo
  const fmtDate = (ts: number | null | undefined) =>
    ts
      ? new Date(ts * 1000).toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
          year: "2-digit",
        })
      : "—";

  const monthly = summary?.subscriptions?.monthly;
  const periodEnd = monthly?.renewalAt;
  const periodStart = monthly?.renewalAt
    ? new Date(
        new Date(monthly.renewalAt * 1000).setMonth(
          new Date(monthly.renewalAt * 1000).getMonth() - 1
        )
      ).getTime() / 1000
    : null;

  // ⚡ Handler para reclamar créditos regalo
  const claimTrial = async () => {
    if (!user) return;
    setClaiming(true);
    try {
      const token = await getIdToken(user, true);
      const res = await fetch("/api/trial/grant", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        // 🔄 Recargar toda la app para reflejar cambios globales
        window.location.reload();
      } else {
        const err = await res.json();
        console.error("Error claimTrial:", err);
      }
    } catch (e) {
      console.error("Error claimTrial:", e);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <>
      {/* 🎁 Banner si hay créditos regalo disponibles */}
      {summary?.trial?.available && !summary?.trial?.used && (
        <div className="w-full bg-white text-black text-sm py-2 px-4 flex justify-between items-center border-b border-border">
          <span>
Tienes créditos de prueba disponibles. Reclámalos para empezar a
            usar la plataforma sin coste.
          </span>
          <button
            onClick={claimTrial}
            disabled={claiming}
            className="ml-4 rounded-md bg-black text-white px-3 py-1 text-sm hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {claiming ? "Reclamando..." : "Reclamar créditos"}
          </button>
        </div>
      )}

      {/* 🔴 Banner si hay deuda */}
      {summary?.hasOverdue && (
        <div className="w-full bg-white text-black text-sm py-2 px-4 flex justify-between items-center border-b border-border">
          <span>
            ⚠️ Tienes una deuda pendiente de{" "}
            <b>{overdueCredits} créditos</b>. Por favor regulariza tu pago para
            seguir usando la plataforma.
          </span>
          <a
            href={process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 rounded-md bg-red-600 text-white px-3 py-1 text-sm hover:bg-red-700 transition"
          >
            Pagar ahora
          </a>
        </div>
      )}

      {/* Topbar */}
      <header className="flex h-14 w-full items-center justify-between border-b border-border bg-card px-4 sm:px-6">
        <div className="md:hidden">
          <CreateReelGlobalButton />
        </div>

        <div className="flex items-center gap-4 ml-auto">
          {loading ? (
            <Skeleton className="h-6 w-28 rounded-md" />
          ) : summary ? (
            <Popover>
              <PopoverTrigger asChild>
                <Badge
                  id="consumo-badge"
                  variant={summary.hasOverdue ? "destructive" : "secondary"}
                  className={`cursor-pointer px-3 py-1 rounded-md ${
                    summary.hasOverdue
                      ? "bg-red-600 text-white"
                      : "bg-neutral-800 text-white"
                  }`}
                >
                  {summary.hasOverdue
                    ? `Deuda: ${overdueCredits} créditos`
                    : `Consumo: ${pendingCredits} créditos`}
                </Badge>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-80 rounded-2xl border border-neutral-800 bg-black text-white p-6 shadow-lg space-y-6"
              >
                <div>
                  <h4 className="text-sm text-neutral-400">
                    Consumo del mes ({fmtDate(periodStart)} – {fmtDate(periodEnd)})
                  </h4>
                  <div className="text-4xl font-semibold mt-1">
                    {pendingCredits}{" "}
                    <span className="text-lg font-normal">créditos</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-neutral-400 text-sm">Créditos disponibles</p>
                  <div className="text-2xl font-semibold">
                    {availableCredits}{" "}
                    <span className="text-lg font-normal">créditos</span>
                  </div>
                  {monthly?.trialing && (
                    <p className="text-xs text-neutral-500">
                      Créditos de prueba hasta {fmtDate(monthly.renewalAt)}
                    </p>
                  )}
                </div>

                <div className="space-y-1 pt-2 border-t border-neutral-800">
                  <p className="text-neutral-400 text-sm">Hoy</p>
                  <p className="text-sm text-neutral-500">
                    Cargo hoy a las 23:59 (Europa/Madrid)
                  </p>
                  <div className="text-lg font-medium mt-1">
                    {(summary?.pendingUsageCents ?? 0) / 100}€ · {pendingCredits} créditos
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ) : null}


          {user && (
            <div id="user-dropdown">
              <UserDropdown user={{ email: user.email ?? "—" }} />
            </div>
          )}
        </div>
      </header>
    </>
  );
}
