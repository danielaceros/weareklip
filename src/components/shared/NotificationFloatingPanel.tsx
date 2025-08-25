"use client";

import { markLogsAsRead, markSingleLogAsRead, Log } from "@/lib/logs";
import Link from "next/link";
import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { subscribeToUnreadLogs } from "@/lib/logs";
import { checkIsAdmin } from "@/lib/users";

interface Props {
  onClose: () => void;
}

export default function NotificationFloatingPanel({ onClose }: Props) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let unsubscribeLogs: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeLogs) unsubscribeLogs();
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

  const handleMarkAll = async () => {
    await markLogsAsRead(logs, isAdmin);
    setLogs([]);
    onClose();
  };

  const handleMarkOne = async (log: Log) => {
    await markSingleLogAsRead(log, isAdmin);
    setLogs((prev) => prev.filter((l) => l.id !== log.id));
  };

  return (
    <div className="absolute bottom-16 right-0 w-80 max-h-96 bg-card border border-border rounded-xl shadow-xl flex flex-col">
      <div className="p-4 border-b flex justify-between items-center">
        <h4 className="font-semibold text-sm">Notificaciones</h4>
        {logs.length > 0 && (
          <button
            onClick={handleMarkAll}
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
                <p className="text-xs text-muted-foreground">{log.message}</p>
              </div>
              <button
                onClick={() => handleMarkOne(log)}
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
  );
}
