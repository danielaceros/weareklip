"use client";

import { useCallback, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { getIdToken } from "firebase/auth";

type Verdict = "active" | "trialing" | "none" | "unknown" | "canceled" | "unpaid";

type SubscriptionInfo = {
  active: boolean;
  trialing: boolean;
  status: string | null;
  cancelAtPeriodEnd?: boolean;
} | null;

type SummaryResponse = {
  subscriptions?: {
    monthly?: SubscriptionInfo;
    usage?: SubscriptionInfo;
  };
  payment?: { hasDefaultPayment: boolean };
  overdueCents?: number;
};

export default function useSubscriptionGate() {
  const [showCheckout, setShowCheckout] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [blockedFeature, setBlockedFeature] = useState<string | null>(null);
  const [forcedPlan, setForcedPlan] = useState<
    "ACCESS" | "MID" | "CREATOR" | "BUSINESS" | null
  >(null);
  const [message, setMessage] = useState<string | undefined>(undefined);

  const cacheRef = useRef<{
    verdict: Verdict;
    ts: number;
    hasPayment: boolean;
  }>({
    verdict: "unknown",
    ts: 0,
    hasPayment: false,
  });

  const computeVerdict = (
    monthly: SubscriptionInfo,
    usage: SubscriptionInfo,
    overdueCents?: number
  ): Verdict => {
    // prioridad global
    if ((overdueCents ?? 0) > 0) return "unpaid";

    // si cualquiera de las dos está marcada para cancelar
    if (monthly?.cancelAtPeriodEnd || usage?.cancelAtPeriodEnd) return "canceled";

    // si alguna está trial → trial
    if (monthly?.trialing || usage?.trialing) return "trialing";

    // ambas deben estar activas
    if (monthly?.active && usage?.active) return "active";

    // si alguna está explícitamente cancelada
    if (
      monthly?.status === "canceled" ||
      usage?.status === "canceled" ||
      monthly?.status === "incomplete_expired" ||
      usage?.status === "incomplete_expired"
    ) {
      return "canceled";
    }

    return "none";
  };

  const readVerdict = useCallback(
    async (): Promise<{ verdict: Verdict; hasPayment: boolean }> => {
      const now = Date.now();

      if (now - cacheRef.current.ts < 15000 && cacheRef.current.verdict !== "unknown") {
        return {
          verdict: cacheRef.current.verdict,
          hasPayment: cacheRef.current.hasPayment,
        };
      }

      const user = auth.currentUser;
      if (!user) return { verdict: "none", hasPayment: false };

      try {
        const token = await getIdToken(user, true);
        const res = await fetch("/api/billing/summary", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json()) as SummaryResponse;

        const monthly: SubscriptionInfo = data.subscriptions?.monthly ?? null;
        const usage: SubscriptionInfo = data.subscriptions?.usage ?? null;

        const verdict = computeVerdict(monthly, usage, data.overdueCents);
        const hasPayment = data?.payment?.hasDefaultPayment === true;

        cacheRef.current = { verdict, ts: now, hasPayment };

        return { verdict, hasPayment };
      } catch (err) {
        console.error("❌ error en readVerdict:", err);
        return { verdict: "none", hasPayment: false };
      }
    },
    []
  );

  const ensureSubscribed = useCallback(
    async (opts?: {
      feature?: string;
      plan?: "ACCESS" | "MID" | "CREATOR" | "BUSINESS";
    }) => {
      const { verdict } = await readVerdict();

      if (verdict === "active" || verdict === "trialing") return true;

      if (opts?.feature) setBlockedFeature(opts.feature);

      if (verdict === "none") {
        setForcedPlan(opts?.plan ?? "ACCESS");
        setMessage("Necesitas una suscripción para usar esta función.");
        setShowCheckout(true);
      } else if (verdict === "canceled" || verdict === "unpaid") {
        setShowRenew(true);
      }

      return false;
    },
    [readVerdict]
  );

  const invalidateSubscription = useCallback(() => {
    cacheRef.current = { verdict: "unknown", ts: 0, hasPayment: false };
  }, []);

  return { ensureSubscribed, invalidateSubscription };
}

