"use client";

import { useEffect, useState } from "react";
import { Plus, Bell, Bot, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import NotificationFloatingPanel from "@/components/shared/NotificationFloatingPanel";
import ChatbotPanel from "@/components/shared/ChatbotPanel";
import { usePushInbox } from "@/lib/pushInbox";
import { AnimatePresence, motion } from "framer-motion";

export default function CreateReelGlobalButton() {
  const [openNotif, setOpenNotif] = useState(false);
  const [openChat, setOpenChat] = useState(false);
  const [openMobileMenu, setOpenMobileMenu] = useState(false);
  const router = useRouter();
  const { unread } = usePushInbox();

  const redirectToSupport = () => {
    // Redirigir a la URL de Notion
    window.open(
      "https://weareklip.notion.site/25f690859b7b8082838dee56be9fcaf4?pvs=105",
      "_blank"
    );
  };

  return (
    <>
      {/* Overlay para cerrar al hacer clic fuera */}
      {openNotif && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenNotif(false)} />
      )}

      {/* 📱 MÓVIL: Speed Dial */}
      <div
        id="btn-menu-dial"
        className="fixed bottom-20 right-6 z-50 flex flex-col items-end gap-3 md:hidden"
      >
        <AnimatePresence>
          {openMobileMenu && (
            <>
              {/* Notificaciones */}
              <motion.button
                id="btn-notifications"
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.25 }}
                onClick={() => setOpenNotif((v) => !v)}
                className="relative bg-neutral-900 text-white rounded-full w-12 h-12 flex items-center justify-center shadow hover:bg-neutral-800 transition"
              >
                <Bell className="w-5 h-5" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full px-1.5">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </motion.button>

              {/* Chatbot */}
              <motion.button
                id="btn-chatbot"
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.25 }}
                onClick={() => setOpenChat((v) => !v)}
                className="relative bg-neutral-900 text-white rounded-full w-12 h-12 flex items-center justify-center shadow hover:bg-neutral-800 transition"
              >
                <Bot className="w-5 h-5" />
              </motion.button>

              {/* Soporte */}
              <motion.button
                id="btn-support"
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.25 }}
                onClick={() =>
                  document.getElementById("feedbacklabelspan")?.click()
                }
                className="relative bg-neutral-900 text-white rounded-full w-12 h-12 flex items-center justify-center shadow hover:bg-neutral-800 transition"
              >
                <MessageCircleQuestion className="w-5 h-5" />
              </motion.button>
            </>
          )}
        </AnimatePresence>

        {/* Fila inferior: Crear reel + botón principal */}
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {openMobileMenu && (
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                <Button
                  id="btn-create-reel"
                  onClick={() => router.push("/dashboard/create")}
                  variant="secondary"
                  className="rounded-lg bg-white text-black hover:bg-neutral-100 shadow px-4 py-2 flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Crear Reel
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Botón principal ➕ */}
          <motion.button
            onClick={() => setOpenMobileMenu((v) => !v)}
            animate={{ rotate: openMobileMenu ? 45 : 0 }}
            transition={{ duration: 0.25 }}
            className="rounded-full bg-white text-black w-14 h-14 flex items-center justify-center shadow-lg hover:bg-primary/90 transition"
          >
            <Plus className="w-6 h-6" />
          </motion.button>
        </div>
      </div>

      {/* 💻 ESCRITORIO: botones en fila */}
      <div className="fixed bottom-6 right-6 z-50 hidden md:flex flex-row items-center gap-3">
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
          onClick={redirectToSupport}
          className="relative bg-neutral-900 text-white rounded-full p-3 shadow hover:bg-neutral-800 transition"
        >
          <MessageCircleQuestion className="w-5 h-5" />
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

