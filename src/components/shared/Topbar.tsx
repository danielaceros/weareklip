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
import { toast } from "sonner";
import CheckoutRedirectModal from "@/components/shared/CheckoutRedirectModal";
import { useT } from "@/lib/i18n";

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
  const t = useT();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [user, setUser] = useState(auth.currentUser);

  // 👇 control del modal
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);

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
          toast.error(t("topbar.trial.activateFirst"));
          setCheckoutModalOpen(true); // 👈 abre el modal
        } else {
          console.error("Error claimTrial:", data);
          toast.error(t("topbar.trial.claimError"));
        }
      }
    } catch (e) {
      console.error("Error claimTrial:", e);
      toast.error(t("topbar.trial.unexpectedError"));
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
          {t("topbar.mobileBanner")}
        </p>
      </div>

      {/* 🎁 Banner si hay créditos regalo disponibles y el usuario ya entró en trial */}
      {!isOnboarding &&
        summary?.trial?.available &&
        !summary?.trial?.used &&
        summary?.subscriptions?.monthly?.status === "trialing" && (
          <div className="w-full bg-white text-black text-sm py-2 px-4 flex justify-between items-center border-b border-border">
            <span>{t("topbar.trial.banner")}</span>
            <button
              onClick={claimTrial}
              disabled={claiming}
              className="ml-4 rounded-md bg-black text-white px-3 py-1 text-sm hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {claiming ? t("topbar.trial.claiming") : t("topbar.trial.claim")}
            </button>
          </div>
        )}

      {/* 🔴 Banner si hay deuda */}
      {summary?.hasOverdue && (
        <div className="w-full bg-white text-black text-sm py-2 px-4 flex justify-between items-center border-b border-border">
          <span>
            {t("topbar.overdue.banner", { credits: overdueCredits })}
          </span>
          <a
            href={process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 rounded-md bg-red-600 text-white px-3 py-1 text-sm hover:bg-red-700 transition"
          >
            {t("topbar.overdue.payNow")}
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
                    ? t("topbar.badge.debt", { credits: overdueCredits })
                    : t("topbar.badge.usage", { credits: usageCredits })}
                </Badge>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-72 rounded-2xl border border-neutral-800 bg-black text-white p-6 shadow-lg space-y-6"
              >
                <div>
                  <h4 className="text-sm text-neutral-400">
                    {t("topbar.popover.monthUsage")}
                  </h4>
                  <div className="text-4xl font-semibold mt-1">
                    {usageCredits}{" "}
                    <span className="text-lg font-normal">
                      {t("topbar.popover.creditsUnit")}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-neutral-400 text-sm">
                    {t("topbar.popover.available")}
                  </p>
                  <div className="text-2xl font-semibold">
                    {availableCredits}{" "}
                    <span className="text-lg font-normal">
                      {t("topbar.popover.creditsUnit")}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 pt-2 border-t border-neutral-800">
                  <p className="text-neutral-400 text-sm">{t("topbar.popover.today")}</p>
                  <p className="text-sm text-neutral-500">
                    {t("topbar.popover.chargeAt")}
                  </p>
                  <div className="text-lg font-medium mt-1">
                    {dailyChargeEuros}€ · {dailyChargeCredits}{" "}
                    {t("topbar.popover.creditsUnit")}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ) : null}

          {user && (
            <div id="user-dropdown">
              <UserDropdown user={{ email: user.email ?? t("common.unknown") }} />
            </div>
          )}
        </div>
      </header>

      {/* Modal de checkout */}
      <CheckoutRedirectModal
        open={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        plan="ACCESS"
        message={t("billing.checkoutModal.activateTrialMessage")}
      />
    </>
  );
}
