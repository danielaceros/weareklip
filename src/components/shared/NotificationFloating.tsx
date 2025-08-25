"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  subscribeToUnreadLogs,
  markLogsAsRead,
  markSingleLogAsRead,
  Log,
} from "@/lib/logs";
import { checkIsAdmin } from "@/lib/users";
import { Bell } from "lucide-react";
import Link from "next/link";

export default function NotificationFloating() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let unsubscribeLogs: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeLogs) {
        unsubscribeLogs();
        unsubscribeLogs = null;
      }
      if (!user) {
        setIsAdmin(false);
        setLogs([]);
        return;
      }
      const admin = await checkIsAdmin(user.uid);
      setIsAdmin(admin);
      unsubscribeLogs = subscribeToUnreadLogs(user.uid, admin, (data) => {
        setLogs(data);
      });
    });
    return () => {
      if (unsubscribeLogs) unsubscribeLogs();
      unsubscribeAuth();
    };
  }, []);

  const unreadCount = logs.length;

  const handleMarkAsRead = async () => {
    await markLogsAsRead(logs, isAdmin);
    setOpen(false);
  };

  const handleMarkSingle = async (log: Log) => {
    await markSingleLogAsRead(log, isAdmin);
    setLogs((prev) => prev.filter((l) => l.id !== log.id));
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative bg-neutral-900 text-white rounded-full p-3 shadow hover:bg-neutral-800 transition"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full px-1.5">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-14 right-0 w-80 max-h-96 bg-card border border-border rounded-xl shadow-xl flex flex-col">
          <div className="p-4 border-b flex justify-between items-center">
            <h4 className="font-semibold text-sm">Notificaciones</h4>
            {logs.length > 0 && (
              <button
                onClick={handleMarkAsRead}
                className="text-xs text-blue-600 hover:underline"
              >
                Marcar todas
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin alertas nuevas</p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-muted p-2 rounded-md text-sm hover:bg-accent/20 transition flex justify-between items-start gap-2"
                >
                  <div>
                    <strong>{log.action}</strong>
                    <p className="text-xs text-muted-foreground">
                      {log.message}
                    </p>
                  </div>
                  <button
                    onClick={() => handleMarkSingle(log)}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    ✓
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="border-t px-4 py-2 bg-muted/30 text-right">
            <Link
              href={isAdmin ? "/admin/notifications" : "/dashboard/mynotifications"}
              className="text-xs text-blue-500 hover:underline"
            >
              Ver todas →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
