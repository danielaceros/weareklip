"use client";

import { useEffect } from "react";
import useSubscriptionGate from "@/hooks/useSubscriptionGate";

/**
 * Intercepta clicks sobre cualquier elemento que tenga el atributo
 * data-paywall (opcionalmente data-paywall-feature="...").
 * Si el usuario no tiene suscripción: cancela el click y redirige a facturación.
 */
export default function PaywallClickGuard() {
  const { ensureSubscribed } = useSubscriptionGate();

  useEffect(() => {
    const handler = async (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const el = target.closest<HTMLElement>("[data-paywall]");
      if (!el) return;

      const feature = el.getAttribute("data-paywall-feature") || undefined;

      const allowed = await ensureSubscribed({ feature });
      if (!allowed) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // en fase de captura para pillar clicks en cualquier botón/enlace
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [ensureSubscribed]);

  return null;
}
