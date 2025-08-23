"use client";

import { useState, useEffect } from "react";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface Props {
  open: boolean;
  onClose: () => void;
  uid: string;   // 👈 solo necesitamos el uid
  message?: string;
}

export default function EmbeddedCheckoutModal({
  open,
  onClose,
  uid,
  message,
}: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    if (open && uid) {
      fetch("/api/stripe/embedded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }), // 👈 pasamos solo el uid
      })
        .then((res) => res.json())
        .then((data) => setClientSecret(data.client_secret))
        .catch(console.error);
    }
  }, [open, uid]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] flex flex-col bg-black text-white border border-border">
        {message && (
          <div className="mb-3 p-3 text-sm bg-red-500/20 border border-red-500 rounded-md text-red-400">
            {message}
          </div>
        )}

        <div className="flex-1 overflow-y-auto rounded-lg">
          {clientSecret ? (
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{ clientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          ) : (
            <p className="text-center mt-10">Cargando checkout...</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
