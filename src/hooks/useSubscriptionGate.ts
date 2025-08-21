"use client";

import { useCallback, useRef } from "react";
import { auth } from "@/lib/firebase";
import { getIdToken } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";

type Verdict = "active" | "trialing" | "none" | "unknown";

type SummaryResponse = {
  subscription?: {
    active: boolean;
    trialing: boolean;
    status: string | null;
  };
};

export default function useSubscriptionGate() {
  const router = useRouter();
  const pathname = usePathname();

  // caché muy corta para no pegarle al backend en cada click
  const cacheRef = useRef<{ verdict: Verdict; ts: number }>({
    verdict: "unknown",
    ts: 0,
  });

  const readVerdict = useCallback(async (): Promise<Verdict> => {
    const now = Date.now();
    if (now - cacheRef.current.ts < 15000 && cacheRef.current.verdict !== "unknown") {
      return cacheRef.current.verdict;
    }
    const user = auth.currentUser;
    if (!user) return "none";

    try {
      const token = await getIdToken(user, true);
      const res = await fetch("/api/billing/summary", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as SummaryResponse;

      const verdict: Verdict =
        data?.subscription?.active || data?.subscription?.trialing
          ? data?.subscription?.trialing
            ? "trialing"
            : "active"
          : "none";

      cacheRef.current = { verdict, ts: now };
      return verdict;
    } catch {
      return "none";
    }
  }, []);

  const ensureSubscribed = useCallback(
    async (opts?: { feature?: string; redirect?: boolean }) => {
      const verdict = await readVerdict();
      const ok = verdict === "active" || verdict === "trialing";
      if (!ok && opts?.redirect !== false) {
        const p = new URLSearchParams();
        p.set("from", pathname || "/");
        p.set("startCheckout", "1"); // que tu página de facturación abra el embedded
        if (opts?.feature) p.set("feature", opts.feature);
        router.push(`/dashboard/facturacion?${p.toString()}`);
      }
      return ok;
    },
    [pathname, readVerdict, router]
  );

  const invalidateSubscription = useCallback(() => {
    cacheRef.current = { verdict: "unknown", ts: 0 };
  }, []);

  return { ensureSubscribed, invalidateSubscription };
}
