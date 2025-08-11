// src/app/admin/notifications/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  collection,
  orderBy,
  query,
  updateDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es as dfnsEs, enUS as dfnsEn, fr as dfnsFr } from "date-fns/locale";
import { handleError, showSuccess } from "@/lib/errors";
import { Bell, CheckCircle, Clock, Filter } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useLocale } from "next-intl";

type Log = {
  id: string;
  type: "guion" | "video" | "clonacion" | "tarea" | "sistema";
  action: string;
  uid: string;
  userName?: string;
  admin: string; // Email de quien hizo el cambio
  message: string;
  timestamp: { seconds: number; nanoseconds: number };
  readByAdmin: boolean;
  readByClient: boolean;
};

const iconosPorTipo: Record<string, string> = {
  guion: "📜",
  video: "🎥",
  clonacion: "📦",
  tarea: "🧾",
  sistema: "⚙️",
};

// Mensaje bonito en base al tipo + contenido (y traducido)
function friendlyMessage(
  type: Log["type"],
  raw: string,
  t: ReturnType<typeof useT>
) {
  const has = (s: string) => raw.toLowerCase().includes(s.toLowerCase());

  switch (type) {
    case "guion":
      if (has("aprob") || has("approved"))
        return t("admin.notifications.friendly.guion.approved");
      if (has("edit") || has("editó"))
        return t("admin.notifications.friendly.guion.edited");
      if (has("creó") || has("created"))
        return t("admin.notifications.friendly.guion.created");
      if (has("solicit") || has("requested"))
        return t("admin.notifications.friendly.guion.requested");
      break;
    case "video":
      if (has("aprob") || has("approved"))
        return t("admin.notifications.friendly.video.approved");
      if (has("subid") || has("uploaded"))
        return t("admin.notifications.friendly.video.uploaded");
      if (has("edit") || has("editado"))
        return t("admin.notifications.friendly.video.edited");
      break;
    case "clonacion":
      if (has("proces") || has("processed"))
        return t("admin.notifications.friendly.clone.processed");
      if (has("sub") || has("upload"))
        return t("admin.notifications.friendly.clone.uploaded");
      break;
    case "tarea":
      if (has("complet") || has("completed"))
        return t("admin.notifications.friendly.task.completed");
      if (has("asign") || has("assigned"))
        return t("admin.notifications.friendly.task.assigned");
      break;
    case "sistema":
      if (has("manten") || has("maintenance"))
        return t("admin.notifications.friendly.system.maintenance");
      if (has("actualiz") || has("updated"))
        return t("admin.notifications.friendly.system.updated");
      break;
  }
  return raw;
}

export default function AdminNotificationsPage() {
  const t = useT();
  const locale = useLocale(); // 'es' | 'en' | 'fr'
  const dfnsLocale = locale === "fr" ? dfnsFr : locale === "es" ? dfnsEs : dfnsEn;

  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("todos");
  const [filterUser, setFilterUser] = useState("todos");
  const [filterRead, setFilterRead] = useState("todos");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const q = query(collection(db, "logs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedLogs = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            readByAdmin: data.readByAdmin === true ? true : false,
            readByClient: data.readByClient === true ? true : false,
          } as Log;
        });
        setLogs(fetchedLogs);
        setLastUpdate(new Date());
        setLoading(false);
      },
      (error) => {
        console.error("Realtime error:", error);
        handleError(error, t("admin.notifications.errors.realtime"));
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [t]);

  const markAsRead = async (logId: string) => {
    try {
      setLogs((prev) =>
        prev.map((log) => (log.id === logId ? { ...log, readByAdmin: true } : log))
      );
      await updateDoc(doc(db, "logs", logId), { readByAdmin: true });
      showSuccess(t("admin.notifications.toast.markedRead"));
    } catch (error) {
      setLogs((prev) =>
        prev.map((log) => (log.id === logId ? { ...log, readByAdmin: false } : log))
      );
      handleError(error, t("admin.notifications.errors.markRead"));
    }
  };

  const markAllAsRead = async () => {
    const unreadLogs = logs.filter((log) => !log.readByAdmin);
    if (unreadLogs.length === 0) return;

    try {
      setLogs((prev) => prev.map((l) => (!l.readByAdmin ? { ...l, readByAdmin: true } : l)));
      await Promise.all(
        unreadLogs.map((l) => updateDoc(doc(db, "logs", l.id), { readByAdmin: true }))
      );
      showSuccess(t("admin.notifications.toast.markedAll", { count: unreadLogs.length }));
    } catch (error) {
      handleError(error, t("admin.notifications.errors.markAll"));
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("admin.notifications.time.now");
    if (diffMins < 60) return t("admin.notifications.time.minutes", { count: diffMins });
    if (diffHours < 24) return t("admin.notifications.time.hours", { count: diffHours });
    return t("admin.notifications.time.days", { count: diffDays });
  };

  const extractUserEmailFromMessage = (message: string): string => {
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    const match = message.match(emailRegex);
    return match ? match[1] : "";
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const filteredLogs = logs.filter((log) => {
    const userEmail = extractUserEmailFromMessage(log.message);
    const matchesText =
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      log.admin.toLowerCase().includes(search.toLowerCase()) ||
      userEmail.toLowerCase().includes(search.toLowerCase());

    const matchesType = filterType === "todos" || log.type === filterType;
    const matchesUser = filterUser === "todos" || userEmail === filterUser;
    const matchesRead =
      filterRead === "todos" ||
      (filterRead === "leidas" && log.readByAdmin) ||
      (filterRead === "no_leidas" && !log.readByAdmin);

    return matchesText && matchesType && matchesUser && matchesRead;
  });

  const unreadCount = logs.filter((log) => !log.readByAdmin).length;
  const stats = {
    total: logs.length,
    unread: unreadCount,
    today: logs.filter((log) => {
      const logDate = new Date(log.timestamp.seconds * 1000);
      const today = new Date();
      return logDate.toDateString() === today.toDateString();
    }).length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-8 h-8 text-blue-600" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-2 -right-2 bg-yellow-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {t("admin.notifications.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0
                ? t("admin.notifications.subtitle", {
                    unread: unreadCount,
                    today: stats.today,
                  })
                : t("admin.notifications.subtitleAllClear")}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={markAllAsRead}
            size="sm"
            variant={unreadCount > 0 ? "default" : "outline"}
            disabled={unreadCount === 0}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {t("admin.notifications.markAll")}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center bg-card border-border">
          <div className="text-2xl font-bold text-primary">{stats.total}</div>
          <div className="text-sm text-muted-foreground">
            {t("admin.notifications.stats.total")}
          </div>
        </Card>
        <Card className="p-4 text-center bg-card border-border">
          <div className="text-2xl font-bold text-destructive">{stats.unread}</div>
          <div className="text-sm text-muted-foreground">
            {t("admin.notifications.stats.unread")}
          </div>
        </Card>
        <Card className="p-4 text-center bg-card border-border">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.today}</div>
          <div className="text-sm text-muted-foreground">
            {t("admin.notifications.stats.today")}
          </div>
        </Card>
      </div>

      {/* Last update */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span>
          {t("admin.notifications.lastUpdate", {
            timeAgo: formatTimeAgo(lastUpdate),
          })}{" "}
          • 🟢 {t("admin.notifications.realtime")}
        </span>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <span className="font-medium">{t("admin.notifications.filters.title")}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            placeholder={t("admin.notifications.filters.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger>
              <SelectValue placeholder={t("admin.notifications.filters.type")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">
                {t("admin.notifications.filters.allTypes")}
              </SelectItem>
              {Array.from(new Set(logs.map((l) => l.type))).map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {iconosPorTipo[tipo]} {t(`admin.notifications.types.${tipo}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger>
              <SelectValue placeholder={t("admin.notifications.filters.user")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">
                {t("admin.notifications.filters.allUsers")}
              </SelectItem>
              {Array.from(
                new Set(
                  logs.map((log) => {
                    const emailRegex =
                      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
                    const match = log.message.match(emailRegex);
                    return match ? match[1] : "";
                  })
                )
              )
                .filter(Boolean)
                .map((email) => (
                  <SelectItem key={email} value={email}>
                    📧 {email}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Select value={filterRead} onValueChange={setFilterRead}>
            <SelectTrigger>
              <SelectValue placeholder={t("admin.notifications.filters.readState")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">
                {t("admin.notifications.filters.read.all")}
              </SelectItem>
              <SelectItem value="no_leidas">
                {t("admin.notifications.filters.read.unread")}
              </SelectItem>
              <SelectItem value="leidas">
                {t("admin.notifications.filters.read.read")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            📭 {t("admin.notifications.empty.title")}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {search ||
            filterType !== "todos" ||
            filterUser !== "todos" ||
            filterRead !== "todos"
              ? t("admin.notifications.empty.hintFiltered")
              : t("admin.notifications.empty.hint")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const mensaje = friendlyMessage(log.type, log.message, t);
            const timeAgo = formatTimeAgo(
              new Date(log.timestamp.seconds * 1000)
            );
            const userEmail = (() => {
              const emailRegex =
                /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
              const match = log.message.match(emailRegex);
              return match ? match[1] : "";
            })();

            return (
              <Card
                key={log.id}
                className={
                  !log.readByAdmin
                    ? "p-4 transition-all duration-200 hover:shadow-md bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/40"
                    : "p-4 transition-all duration-200 hover:shadow-md bg-card border border-border"
                }
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-2xl">{iconosPorTipo[log.type]}</div>
                      {!log.readByAdmin && (
                        <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-medium">{mensaje}</p>

                        {!log.readByAdmin && (
                          <Badge
                            variant="secondary"
                            className="bg-yellow-200 text-yellow-800 text-xs font-medium"
                          >
                            {t("admin.notifications.badges.unread")}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{timeAgo}</span>
                        </div>
                        <span>👤 {log.admin}</span>
                        <span>
                          📧{" "}
                          {userEmail ||
                            t("admin.notifications.unknownUser", {
                              id: log.uid.substring(0, 8),
                            })}
                        </span>
                        <span className="hidden sm:inline">
                          📅{" "}
                          {format(
                            new Date(log.timestamp.seconds * 1000),
                            "dd/MM/yyyy HH:mm",
                            { locale: dfnsLocale }
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!log.readByAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsRead(log.id)}
                      className="text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100 shrink-0"
                    >
                      {t("admin.notifications.markRead")}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {filteredLogs.length > 0 && (
        <Card className="p-4">
          <div className="text-center text-sm text-muted-foreground">
            {t("admin.notifications.footer", {
              count: filteredLogs.length,
              total: logs.length,
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
