"use client";

import { useEffect, useState } from "react";
import useSubscriptionGate from "@/hooks/useSubscriptionGate";
import CheckoutRedirectModal from "@/components/shared/CheckoutRedirectModal";
import { useRouter, usePathname } from "next/navigation";

export default function DashboardPaywallGuard({ children }: { children: React.ReactNode }) {
  const { ensureSubscribed } = useSubscriptionGate();
  const [showCheckout, setShowCheckout] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 👉 Solo aplicar si está en /dashboard/xxx (no exactamente /dashboard)
    if (pathname && pathname.startsWith("/dashboard/")) {
      (async () => {
        const allowed = await ensureSubscribed({ feature: "dashboard", plan: "ACCESS" });
        if (!allowed) {
          setShowCheckout(true);
        }
      })();
    }
  }, [ensureSubscribed, pathname]);

  const handleClose = () => {
    setShowCheckout(false);
    router.replace("/dashboard"); // 👈 vuelve al root del dashboard
  };

  return (
    <>
      {children}
      <CheckoutRedirectModal
        open={showCheckout}
        onClose={handleClose}
        plan="ACCESS"
        message="Necesitas una suscripción activa para continuar."
      />
    </>
  );
}
