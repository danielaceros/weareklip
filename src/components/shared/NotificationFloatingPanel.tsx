"use client";

import { usePushInbox } from "@/lib/pushInbox";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import clsx from "clsx";

interface Props {
  onClose: () => void;
}

export default function NotificationFloatingPanel({ onClose }: Props) {
  const { items, unread, markAllRead, markOne } = usePushInbox();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <>
      {/* Overlay en móvil */}
      {isMobile && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={onClose}
        />
      )}

      <div
        className={clsx(
          "z-50 bg-card border border-border shadow-xl flex flex-col transition-transform duration-300",
          isMobile
            ? "fixed bottom-0 left-0 w-full h-[65vh] rounded-t-2xl animate-slide-up"
            : "absolute bottom-16 right-0 w-80 max-h-96 rounded-xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center">
          <h4 className="font-semibold text-sm">Notificaciones</h4>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button
                onClick={() => {
                  markAllRead();
                  onClose();
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                Marcar todas
              </button>
            )}
            {isMobile && (
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin alertas nuevas</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => markOne(n.id)}
                className="text-left w-full bg-muted p-2 rounded-md text-sm hover:bg-accent/20 transition flex justify-between items-start gap-2"
              >
                <div>
                  <strong>{n.title || "Notificación"}</strong>
                  {n.body && (
                    <p className="text-xs text-muted-foreground">{n.body}</p>
                  )}
                </div>
                {!n.read && (
                  <span className="text-xs text-blue-500 shrink-0">✓</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 bg-muted/30 text-right">
          <span className="text-xs text-muted-foreground">
            {unread > 0 ? `${unread} sin leer` : "Todo al día"}
          </span>
        </div>
      </div>

      {/* Animación keyframes */}
      <style jsx global>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
      `}</style>
    </>
  );
}
