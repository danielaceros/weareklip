"use client";

import { useState } from "react";
import { Plus, Bell, Bot, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import NotificationFloatingPanel from "@/components/shared/NotificationFloatingPanel";
import ChatbotPanel from "@/components/shared/ChatbotPanel";
import { usePushInbox } from "@/lib/pushInbox";

export default function CreateReelGlobalButton() {
  const [openNotif, setOpenNotif] = useState(false);
  const [openChat, setOpenChat] = useState(false);
  const router = useRouter();
  const { unread } = usePushInbox();

  const redirectToSupport = () => {
    // Redirigir a la URL de Notion
    window.open("https://weareklip.notion.site/25f690859b7b8082838dee56be9fcaf4?pvs=105", "_blank");
  };

  return (
    <>
      {/* Overlay para cerrar al hacer clic fuera */}
      {openNotif && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpenNotif(false)}
        />
      )}

      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {/* Botón Crear Reel */}
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
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full px-1.5">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {/* Botón Chatbot */}
        <button
          id="btn-chatbot"
          onClick={() => setOpenChat((v) => !v)}
          className="relative bg-neutral-900 text-white rounded-full p-3 shadow hover:bg-neutral-800 transition"
        >
          <Bot className="w-5 h-5" />
        </button>

        {/* Botón Soporte */}
        <button
          id="btn-support"
          onClick={redirectToSupport} // Redirigir a la página de Notion
          className="relative bg-neutral-900 text-white rounded-full p-3 shadow hover:bg-neutral-800 transition"
        >
          <LifeBuoy className="w-5 h-5" />
        </button>

        {/* Panels flotantes */}
        {openNotif && (
          <NotificationFloatingPanel onClose={() => setOpenNotif(false)} />
        )}
        {openChat && <ChatbotPanel onClose={() => setOpenChat(false)} />}
      </div>
    </>
  );
}
