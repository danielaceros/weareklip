"use client";

import { useCallback, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { getIdToken } from "firebase/auth";
import EmbeddedCheckoutModal from "@/components/user/EmbeddedCheckoutModal";
import RenewModal from "@/components/billing/RenewModal";

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
  overdueCents?: number;  // 👈 nuevo
};

export default function useSubscriptionGate() {
  const [showEmbed, setShowEmbed] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [blockedFeature, setBlockedFeature] = useState<string | null>(null);

  const cacheRef = useRef<{ verdict: Verdict; ts: number; hasPayment: boolean }>({
    verdict: "unknown",
    ts: 0,
    hasPayment: false,
  });

  const readVerdict = useCallback(async (): Promise<{ verdict: Verdict; hasPayment: boolean }> => {
    const now = Date.now();
    if (now - cacheRef.current.ts < 15000 && cacheRef.current.verdict !== "unknown") {
      return { verdict: cacheRef.current.verdict, hasPayment: cacheRef.current.hasPayment };
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

      // 🚨 Bloqueamos si hay deuda
      if ((data.overdueCents ?? 0) > 0) {
        verdict = "unpaid";
      } else if (!data?.subscription?.status) {
        verdict = "none";
      } else if (data.subscription.cancelAtPeriodEnd === true) {
        verdict = "canceled";
      } else if (data.subscription.status === "active") {
        verdict = "active";
      } else if (data.subscription.status === "trialing") {
        verdict = "trialing";
      } else if (
        data.subscription.status === "canceled" ||
        data.subscription.status === "incomplete_expired"
      ) {
        verdict = "canceled";
      }

      const hasPayment = data?.payment?.hasDefaultPayment === true;

      cacheRef.current = { verdict, ts: now, hasPayment };
      return { verdict, hasPayment };
    } catch {
      return { verdict: "none", hasPayment: false };
    }
  }, []);

  const ensureSubscribed = useCallback(
    async (opts?: { feature?: string }) => {
      const { verdict, hasPayment } = await readVerdict();
      if (verdict === "active" || verdict === "trialing") return true;

      if (opts?.feature) setBlockedFeature(opts.feature);

      if (verdict === "none") {
        setShowEmbed(true);
      } else if (verdict === "canceled") {
        if (hasPayment) setShowRenew(true);
        else setShowEmbed(true);
      } else if (verdict === "unpaid") {
        // 👈 deuda → forzamos renovación/pago
        setShowRenew(true);
      }

      return false;
    },
    [readVerdict]
  );

  const invalidateSubscription = useCallback(() => {
    cacheRef.current = { verdict: "unknown", ts: 0, hasPayment: false };
  }, []);

  const Modals = () => {
    const user = auth.currentUser;
    if (!user) return null;

    return (
      <>
        <EmbeddedCheckoutModal
          open={showEmbed}
          onClose={() => setShowEmbed(false)}
          uid={user.uid}
        />
        <RenewModal
          open={showRenew}
          onClose={() => setShowRenew(false)}
          uid={user.uid}
        />
      </>
    );
  };

  return { ensureSubscribed, invalidateSubscription, Modals };
}
