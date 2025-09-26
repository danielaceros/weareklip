// src/components/billing/RenewModal.tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export default function RenewModal({
  open,
  onClose,
  uid,
}: {
  open: boolean;
  onClose: () => void;
  uid: string;
}) {
  const [loading, setLoading] = useState(false);
  const t = useT();

  const handleRenew = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(data.message || t("billing.toasts.reactivated"));
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || t("billing.toasts.reactivateError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("billing.renewModal.title")}</DialogTitle>
        </DialogHeader>
        <p className="mb-4">
          {t("billing.renewModal.description")}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t("billing.renewModal.cancel")}
          </Button>
          <Button onClick={handleRenew} disabled={loading}>
            {loading ? t("billing.renewModal.reactivating") : t("billing.renewModal.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
