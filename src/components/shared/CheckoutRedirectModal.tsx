"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getAuth } from "firebase/auth";
import { useT } from "@/lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  plan: "ACCESS" | "MID" | "CREATOR" | "BUSINESS";
  message?: string;
}

export default function CheckoutRedirectModal({ open, onClose, plan, message }: Props) {
  const [loading, setLoading] = useState(false);
  const t = useT();

  const startCheckout = async () => {
    try {
      setLoading(true);
      const user = getAuth().currentUser;
      if (!user) throw new Error(t("billing.checkoutModal.errors.mustLogin"));

      const idToken = await user.getIdToken();
      const email = user.email ?? undefined;

      const nextPath = window.location.pathname + window.location.search;
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ plan, email, next: nextPath }),
      });

      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || t("billing.checkoutModal.errors.checkout"));

      if (typeof window !== "undefined" && typeof window.fbq === "function") {
        window.fbq("track", "StartTrial", {
          value: 0.0,
          currency: "EUR",
          predicted_ltv: 29.99,
          plan,
          email,
        });
      }
      // 👉 Redirige a la URL que devuelva el backend (Checkout o Portal)
      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full bg-black text-white border border-border">
        {message && (
          <div className="mb-3 p-3 text-sm bg-red-500/20 border border-red-500 rounded-md text-red-400">
            {message}
          </div>
        )}

        <h2 className="text-lg font-bold mb-2">{t("billing.checkoutModal.title")}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("billing.checkoutModal.description")}
        </p>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {t("billing.checkoutModal.cancel")}
          </Button>
          <Button onClick={startCheckout} disabled={loading}>
            {loading ? t("billing.checkoutModal.redirecting") : t("billing.checkoutModal.continue")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
