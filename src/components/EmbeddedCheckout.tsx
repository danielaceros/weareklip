"use client";

import { useEffect, useRef } from "react";
import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

export default function EmbeddedCheckout({
  clientSecret,
  onComplete,
}: {
  clientSecret: string;
  onComplete?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const checkoutRef = useRef<StripeEmbeddedCheckout | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!clientSecret || !containerRef.current) return;
      // Evita doble montaje (StrictMode)
      if (checkoutRef.current) return;

      const stripe = await stripePromise;
      if (!stripe) return;

      const checkout = await stripe.initEmbeddedCheckout({
        clientSecret,
        ...(onComplete ? { onComplete } : {}),
      });

      if (cancelled) {
        checkout.destroy();
        return;
      }

      // El contenedor DEBE estar vacío
      containerRef.current.innerHTML = "";
      checkout.mount(containerRef.current);
      checkoutRef.current = checkout;
    })();

    return () => {
      cancelled = true;
      checkoutRef.current?.destroy();
      checkoutRef.current = null;
    };
  }, [clientSecret, onComplete]);

  // No metas hijos aquí dentro
  return <div ref={containerRef} />;
}
