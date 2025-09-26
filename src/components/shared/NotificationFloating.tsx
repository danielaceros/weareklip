"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  fetchUnreadLogs,
  markLogsAsRead,
  markSingleLogAsRead,
  Log,
} from "@/lib/logs";
import { checkIsAdmin } from "@/lib/users";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useT } from "@/lib/i18n";

export default function NotificationFloating() {
  const t = useT();
  const [logs, setLogs] = useState<Log[]>([]);
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // --- Listener auth ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setIsAdmin(false);
        setLogs([]);
        setUser(null);
        return;
      }
      setUser(u);
      const admin = await checkIsAdmin(u.uid);
      setIsAdmin(admin);
    });
    return () => unsub();
  }, []);

  // --- Polling de logs ---
  useEffect(() => {
    if (!user) return;

    let stop = false;

    const fetchLoop = async () => {
      try {
        const data = await fetchUnreadLogs(user, isAdmin);
        if (!stop) setLogs(data);
      } catch (err) {
        console.error("Error fetching logs:", err);
      }
      if (!stop) setTimeout(fetchLoop, 10000); // cada 10s
    };

    fetchLoop();
    return () => {
      stop = true;
    };
  }, [user, isAdmin]);

  const unreadCount = logs.length;

  const handleMarkAsRead = async () => {
    if (!user) return;
    await markLogsAsRead(user, logs, isAdmin);
    setLogs([]);
    setOpen(false);
  };

  const handleMarkSingle = async (log: Log) => {
    if (!user) return;
    await markSingleLogAsRead(user, log, isAdmin);
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
            <h4 className="font-semibold text-sm">{t("notifications.title")}</h4>
            {logs.length > 0 && (
              <button
                onClick={handleMarkAsRead}
                className="text-xs text-blue-600 hover:underline"
              >
                {t("notifications.markAll")}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("notifications.empty")}</p>
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
                    aria-label={t("notifications.markOne")}
                    title={t("notifications.markOne")}
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
              {t("notifications.viewAll")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
