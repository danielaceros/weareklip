"use client";

import { useState, useCallback } from "react";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import CreateReelWizard from "@/components/wizard/CreateReelWizard";
import useSubscriptionGate from "@/hooks/useSubscriptionGate";

export default function CreateReelGlobalButton() {
  const [open, setOpen] = useState(false);
  const { ensureSubscribed, Modals } = useSubscriptionGate(); // 👈 usamos Modals

    const handleClick = useCallback(async () => {
    const ok = await ensureSubscribed({ feature: "reel" });
    if (!ok) return; // si no está suscrito, no abre wizard (abre modal correspondiente)
    setOpen(true);
  }, [ensureSubscribed]);

  return (
    <>
      <div className="fixed bottom-20 right-6 z-50">
        <Button
          size="lg"
          onClick={handleClick}
          className="rounded-full shadow-lg bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:opacity-90 transition-all animate-pulse text-white flex items-center gap-2"
        >
          <PlusCircle className="w-5 h-5" />
          Crear Reel IA
        </Button>
      </div>

      {/* Modales de suscripción / renovación */}
      <Modals />

      {/* Wizard */}
      <CreateReelWizard
        open={open}
        onClose={() => setOpen(false)}
        onComplete={() => {}}
      />
    </>
  );
}
