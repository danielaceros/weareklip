"use client";

import { useState, useCallback } from "react";
import { Plus, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import CreateReelWizard from "@/components/wizard/FloatingActions";
import useSubscriptionGate from "@/hooks/useSubscriptionGate";
import NotificationFloatingPanel from "@/components/shared/NotificationFloatingPanel"; // 👈 nuevo panel

export default function FloatingActions() {
  const [openReel, setOpenReel] = useState(false);
  const [openNotif, setOpenNotif] = useState(false);
  const { ensureSubscribed, Modals } = useSubscriptionGate();

  const handleClickReel = useCallback(async () => {
    const ok = await ensureSubscribed({ feature: "reel" });
    if (!ok) return;
    setOpenReel(true);
  }, [ensureSubscribed]);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {/* Botón Crear reel */}
        <Button
          onClick={handleClickReel}
          variant="secondary"
          className="rounded-lg bg-white text-black hover:bg-neutral-100 shadow px-4 py-2 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Crear reel
        </Button>

        {/* Botón Notificaciones */}
        <button
          onClick={() => setOpenNotif((v) => !v)}
          className="relative bg-neutral-900 text-white rounded-full p-3 shadow hover:bg-neutral-800 transition"
        >
          <Bell className="w-5 h-5" />
          {/* Badge de notificaciones */}
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full px-1.5">
            3
          </span>
        </button>

        {/* Panel de notificaciones */}
        {openNotif && <NotificationFloatingPanel onClose={() => setOpenNotif(false)} />}
      </div>

      {/* Modales de suscripción */}
      <Modals />

      {/* Wizard de creación de reels */}
      <CreateReelWizard
        open={openReel}
        onClose={() => setOpenReel(false)}
        onComplete={() => {}}
      />
    </>
  );
}
