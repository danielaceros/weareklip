"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

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

  const handleRenew = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),   // 👈 ahora mandamos uid
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(data.message || "Suscripción reactivada");
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error al reactivar suscripción");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tu plan está cancelado</DialogTitle>
        </DialogHeader>
        <p className="mb-4">
          ¿Quieres reactivar tu suscripción y volver a disfrutar de todas las ventajas de KLIP?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            No
          </Button>
          <Button onClick={handleRenew} disabled={loading}>
            {loading ? "Reactivando..." : "Sí, reactivar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
