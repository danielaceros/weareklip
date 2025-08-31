"use client";

import { useCallback, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { getIdToken } from "firebase/auth";

type Verdict = "active" | "trialing" | "none" | "unknown" | "canceled" | "unpaid";

type SummaryResponse = {
  subscription?: {
    active: boolean;
    trialing: boolean;
    status: string | null;
    cancelAtPeriodEnd?: boolean;
  };
  payment?: {
    hasDefaultPayment: boolean;
  };
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

  const readVerdict = useCallback(async (): Promise<{ verdict: Verdict; hasPayment: boolean }> => {
    const now = Date.now();

    // cache: 15 segundos
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

      let verdict: Verdict = "none";

      // 1. pagos pendientes
      if ((data.overdueCents ?? 0) > 0) {
        verdict = "unpaid";
      }
      // 2. cancelado al final del periodo
      else if (data.subscription?.cancelAtPeriodEnd) {
        verdict = "canceled";
      }
      // 3. trial explícito
      else if (data.subscription?.trialing) {
        verdict = "trialing";
      }
      // 4. activo
      else if (data.subscription?.active) {
        verdict = "active";
      }
      // 5. estados cancelados explícitos
      else if (
        data.subscription?.status === "canceled" ||
        data.subscription?.status === "incomplete_expired"
      ) {
        verdict = "canceled";
      }
      // 6. sin sub
      else {
        verdict = "none";
      }


      const hasPayment = data?.payment?.hasDefaultPayment === true;
      cacheRef.current = { verdict, ts: now, hasPayment };

      return { verdict, hasPayment };
    } catch (err) {
      console.error("❌ error en readVerdict:", err);
      return { verdict: "none", hasPayment: false };
    }
  }, []);

  const ensureSubscribed = useCallback(
    async (opts?: {
      feature?: string;
      plan?: "ACCESS" | "MID" | "CREATOR" | "BUSINESS";
    }) => {
      const { verdict, hasPayment } = await readVerdict();

      if (verdict === "active" || verdict === "trialing") return true;

      if (opts?.feature) setBlockedFeature(opts.feature);

      if (verdict === "none") {
        // 👉 Mostrar checkout redirect (puede llevar trial)
        setForcedPlan(opts?.plan ?? "ACCESS");
        setMessage("Necesitas una suscripción para usar esta función.");
        setShowCheckout(true);
      } else if (verdict === "canceled" || verdict === "unpaid") {
        // 👉 Si ya tuvo subs pero la canceló o está impaga
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
