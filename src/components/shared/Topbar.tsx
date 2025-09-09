"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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
import { toast } from "sonner"; // 👈 importamos de sonner

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

  const pathname = usePathname();

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
  const overdueCredits = toCredits(summary?.overdueCents);

  // ⚡ Uso total del mes (excluye prueba)
  const usageCredits =
    summary?.trial && summary.trial.available && !summary.trial.used
      ? 0
      : toCredits(summary?.pendingUsageCents);

  // ⚡ Cargo diario real (solo si no está en trial)
  const dailyChargeEuros =
    summary?.trial && summary.trial.available && !summary.trial.used
      ? 0
      : (summary?.pendingUsageCents ?? 0) / 100;
  const dailyChargeCredits =
    summary?.trial && summary.trial.available && !summary.trial.used
      ? 0
      : usageCredits;

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
      const data = await res.json();

      if (res.ok) {
        window.location.reload();
      } else {
        if (data.error === "El cliente no tiene un periodo de prueba activo") {
          toast.error("Para reclamar créditos primero activa tu prueba gratuita desde Stripe.");
        } else {
          console.error("Error claimTrial:", data);
          toast.error(data.error || "No se pudo reclamar la prueba.");
        }
      }
    } catch (e) {
      console.error("Error claimTrial:", e);
      toast.error("Ocurrió un error inesperado al reclamar los créditos.");
    } finally {
      setClaiming(false);
    }
  };

  const isOnboarding = pathname?.startsWith("/onboarding");

  return (
    <>
      {/* 📱 Banner solo en móvil */}
      <div className="w-full bg-yellow-100 text-yellow-900 text-sm py-2 px-4 md:hidden">
        <p className="text-center whitespace-normal break-words leading-snug">
          🚀 Es mucho mejor usar <b>Viralizalo.AI</b> en PC para una mejor experiencia.
        </p>
      </div>

      {/* 🎁 Banner si hay créditos regalo disponibles */}
      {!isOnboarding &&
        summary?.trial?.available &&
        !summary?.trial?.used && (
          <div className="w-full bg-white text-black text-sm py-2 px-4 flex justify-between items-center border-b border-border">
            <span>
              Tienes créditos de prueba disponibles. Reclámalos para empezar a usar
              la plataforma sin coste.
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
                    : `Uso total: ${usageCredits} créditos`}
                </Badge>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-72 rounded-2xl border border-neutral-800 bg-black text-white p-6 shadow-lg space-y-6"
              >
                <div>
                  <h4 className="text-sm text-neutral-400">Uso total del mes</h4>
                  <div className="text-4xl font-semibold mt-1">
                    {usageCredits}{" "}
                    <span className="text-lg font-normal">créditos</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-neutral-400 text-sm">
                    Créditos disponibles (incluye prueba)
                  </p>
                  <div className="text-2xl font-semibold">
                    {availableCredits}{" "}
                    <span className="text-lg font-normal">créditos</span>
                  </div>
                </div>

                <div className="space-y-1 pt-2 border-t border-neutral-800">
                  <p className="text-neutral-400 text-sm">Hoy</p>
                  <p className="text-sm text-neutral-500">
                    Cargo hoy a las 23:59 (Europa/Madrid)
                  </p>
                  <div className="text-lg font-medium mt-1">
                    {dailyChargeEuros}€ · {dailyChargeCredits} créditos
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
