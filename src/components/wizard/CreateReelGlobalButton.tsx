"use client";

import { useState } from "react";
import { Plus, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import NotificationFloatingPanel from "@/components/shared/NotificationFloatingPanel";

export default function CreateReelGlobalButton() {
  const [openNotif, setOpenNotif] = useState(false);
  const router = useRouter();

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {/* Botón Crear reel */}
        <Button
          id="btn-create-reel"
          onClick={() => router.push("/dashboard/create")}
          variant="secondary"
          className="rounded-lg bg-white text-black hover:bg-neutral-100 shadow px-4 py-2 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Crear reel
        </Button>

        {/* Botón Notificaciones */}
        <button
          id="btn-notifications"
          onClick={() => setOpenNotif((v) => !v)}
          className="relative bg-neutral-900 text-white rounded-full p-3 shadow hover:bg-neutral-800 transition"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full px-1.5">
            3
          </span>
        </button>

        {openNotif && <NotificationFloatingPanel onClose={() => setOpenNotif(false)} />}
      </div>
    </>
  );
}
