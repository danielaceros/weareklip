"use client";

import { usePushInbox } from "@/lib/pushInbox";

interface Props {
  onClose: () => void;
}

export default function NotificationFloatingPanel({ onClose }: Props) {
  const { items, unread, markAllRead, markOne } = usePushInbox();

  return (
    <div
      className="absolute bottom-16 right-0 w-80 max-w-[90vw] max-h-96 bg-card border border-border rounded-xl shadow-xl flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4 border-b flex justify-between items-center">
        <h4 className="font-semibold text-sm">Notificaciones</h4>
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
      </div>

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
                {n.body ? (
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                ) : null}
              </div>
              {!n.read && (
                <span className="text-xs text-blue-500 shrink-0">✓</span>
              )}
            </button>
          ))
        )}
      </div>

      <div className="border-t px-4 py-2 bg-muted/30 text-right">
        <span className="text-xs text-muted-foreground">
          {unread > 0 ? `${unread} sin leer` : "Todo al día"}
        </span>
      </div>
    </div>
  );
}
