// src/components/wizard/CreateReelGlobalBotton.tsx
"use client";

import { useState, useCallback } from "react";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import CreateReelWizard from "@/components/wizard/CreateReelWizard";
import useSubscriptionGate from "@/hooks/useSubscriptionGate"; // 👈 NUEVO

export default function CreateReelGlobalButton() {
  const [open, setOpen] = useState(false);
  const { ensureSubscribed } = useSubscriptionGate();

  const handleClick = useCallback(async () => {
    // Comprueba suscripción (activa o trial). Si no, redirige a facturación.
    const ok = await ensureSubscribed({ feature: "reel" });
    if (!ok) return;
    setOpen(true);
  }, [ensureSubscribed]);

  return (
    <>
      {/* Botón flotante */}
      <div className="fixed bottom-20 right-6 z-50">
        <Button
          size="lg"
          data-paywall
          data-paywall-feature="reel"
          className="rounded-full shadow-lg bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:opacity-90 transition-all animate-pulse text-white flex items-center gap-2"
          onClick={handleClick}
        >
          <PlusCircle className="w-5 h-5" />
          Crear Reel IA
        </Button>
      </div>

      {/* Modal Wizard */}
      <CreateReelWizard
        open={open}
        onClose={() => setOpen(false)}
        onComplete={(data) => {
          console.log("Datos del guion aceptado:", data);
        }}
      />
    </>
  );
}
