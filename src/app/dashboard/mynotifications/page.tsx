"use client";

import { useEffect, useState } from "react";
import {
  collection,
  orderBy,
  query,
  where,
  updateDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
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
import { format, type Locale as DateFnsLocale } from "date-fns";
import { es as esLocale, enUS as enLocale } from "date-fns/locale";
import { handleError, showSuccess } from "@/lib/errors";
import { Bell, CheckCircle, Clock, Filter } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

/* ---------- helpers de fecha: convierten cualquier cosa a Date seguro ------ */
type TimestampWithToDate = { toDate: () => Date };
type TimestampWithSeconds = { seconds: number; nanoseconds?: number };
type FirestoreLikeTimestamp =
  | TimestampWithToDate
  | TimestampWithSeconds
  | string
  | number
  | Date
  | null
  | undefined;

function hasToDate(x: unknown): x is TimestampWithToDate {
  return (
    typeof x === "object" &&
    x !== null &&
    "toDate" in x &&
    typeof (x as { toDate?: unknown }).toDate === "function"
  );
}
function hasSeconds(x: unknown): x is TimestampWithSeconds {
  return (
    typeof x === "object" &&
    x !== null &&
    "seconds" in x &&
    typeof (x as { seconds?: unknown }).seconds === "number"
  );
}
function tsToDate(input: FirestoreLikeTimestamp): Date {
  if (input == null) return new Date(0);
  if (input instanceof Date) return input;
  if (typeof input === "number") return new Date(input);
  if (typeof input === "string") {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? new Date(0) : d;
  }
  if (hasToDate(input)) return input.toDate();
  if (hasSeconds(input)) return new Date(input.seconds * 1000);
  return new Date(0);
}
function formatTs(input: FirestoreLikeTimestamp, fmt: string, locale: DateFnsLocale) {
  return format(tsToDate(input), fmt, { locale });
}

/* --------------------------------- Tipos ---------------------------------- */
type LogType = "guion" | "video" | "clonacion" | "tarea" | "sistema";
type Log = {
  id: string;
  type: LogType;
  action: string;
  uid: string;
  admin: string;
  message: string;
  timestamp: FirestoreLikeTimestamp;
  readByClient: boolean;
};

const iconosPorTipo: Record<LogType, string> = {
  guion: "📜",
  video: "🎥",
  clonacion: "📦",
  tarea: "🧾",
  sistema: "⚙️",
};

export default function UserNotificationsPage() {
  const t = useTranslations("notificationsPage");
  const localeCode = useLocale();
  const dfLocale: DateFnsLocale = localeCode === "en" ? enLocale : esLocale;

  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"todos" | LogType>("todos");
  const [filterRead, setFilterRead] = useState<"todos" | "no_leidas" | "leidas">("todos");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        handleError(null, t("authRequired"));
        setLoading(false);
        return;
      }
      setUserId(user.uid);
      setupRealTimeListener(user.uid);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setupRealTimeListener = (uid: string) => {
    const qy = query(
      collection(db, "logs"),
      where("uid", "==", uid),
      orderBy("timestamp", "desc")
    );
    const unsubscribe = onSnapshot(
      qy,
      (snapshot) => {
        const fetchedLogs = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Log, "id">),
        }));
        setLogs(fetchedLogs);
        setLastUpdate(new Date());
        setLoading(false);
      },
      (error) => {
        console.error("Error en tiempo real:", error);
        handleError(error, t("errors.realtime"));
        setLoading(false);
      }
    );
    return unsubscribe;
  };

  const markAsRead = async (logId: string) => {
    if (!userId) return;
    try {
      setLogs((prev) => prev.map((l) => (l.id === logId ? { ...l, readByClient: true } : l)));
      await updateDoc(doc(db, "logs", logId), { readByClient: true });
      showSuccess(t("toast.markedRead"));
    } catch (error) {
      setLogs((prev) => prev.map((l) => (l.id === logId ? { ...l, readByClient: false } : l)));
      handleError(error, t("errors.markRead"));
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesText =
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      log.admin.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "todos" || log.type === filterType;
    const matchesRead =
      filterRead === "todos" ||
      (filterRead === "leidas" && log.readByClient) ||
      (filterRead === "no_leidas" && !log.readByClient);
    return matchesText && matchesType && matchesRead;
  });

  const markAllAsRead = async () => {
    if (!userId) return;
    const unreadLogs = filteredLogs.filter((l) => !l.readByClient);
    if (unreadLogs.length === 0) return;
    try {
      setLogs((prev) => prev.map((l) => ({ ...l, readByClient: true })));
      await Promise.all(
        unreadLogs.map((l) => updateDoc(doc(db, "logs", l.id), { readByClient: true }))
      );
      showSuccess(t("toast.markedAll", { count: unreadLogs.length }));
    } catch (error) {
      setupRealTimeListener(userId);
      handleError(error, t("errors.markAll"));
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return t("time.now");
    if (diffMins < 60) return t("time.minutes", { count: diffMins });
    if (diffHours < 24) return t("time.hours", { count: diffHours });
    return t("time.days", { count: diffDays });
  };

  const friendlyMessage = (log: Log) => {
    const m = log.message.match(/"([^"]+)"/);
    const title = m?.[1];

    switch (log.type) {
      case "guion":
        if (log.action === "aprobado") {
          return title
            ? t("friendly.guion.approvedWith", { title })
            : t("friendly.guion.approved");
        }
        if (log.action === "cambios_solicitados") {
          return title
            ? t("friendly.guion.requestedWith", { title })
            : t("friendly.guion.requested");
        }
        return log.message;

      case "video":
        if (log.action === "aprobado") {
          return title
            ? t("friendly.video.approvedWith", { title })
            : t("friendly.video.approved");
        }
        if (log.action === "cambios_solicitados") {
          return title
            ? t("friendly.video.requestedWith", { title })
            : t("friendly.video.requested");
        }
        if (log.action === "subio" || log.action === "subió") {
          return t("friendly.video.uploaded");
        }
        return log.message;

      case "clonacion":
        if (log.action === "subio" || log.action === "subió") return t("friendly.clone.uploaded");
        if (log.action === "procesado" || log.action === "procesada") return t("friendly.clone.processed");
        return log.message;

      case "tarea":
        if (log.action === "completada") return t("friendly.task.completed");
        if (log.action === "asignada") return t("friendly.task.assigned");
        return log.message;

      case "sistema":
        if (log.action === "mantenimiento") return t("friendly.system.maintenance");
        if (log.action === "actualizacion" || log.action === "actualización")
          return t("friendly.system.updated");
        return log.message;

      default:
        return log.message;
    }
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

  const unreadCount = logs.filter((log) => !log.readByClient).length;
  const stats = {
    total: logs.length,
    unread: unreadCount,
    today: logs.filter((log) => {
      const logDate = tsToDate(log.timestamp);
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
            <Bell className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-2 -right-2 bg-amber-500 text-white dark:bg-amber-500 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0
                ? t("subtitle", { unread: unreadCount, today: stats.today })
                : t("subtitleAllClear")}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button onClick={markAllAsRead} size="sm">
              <CheckCircle className="w-4 h-4 mr-2" />
              {t("markAll")}
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</div>
          <div className="text-sm text-muted-foreground">{t("stats.total")}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.unread}</div>
          <div className="text-sm text-muted-foreground">{t("stats.unread")}</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.today}</div>
          <div className="text-sm text-muted-foreground">{t("stats.today")}</div>
        </Card>
      </div>

      {/* Last update */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span>{t("lastUpdate", { timeAgo: formatTimeAgo(lastUpdate) })}</span>
      </div>

      {/* Filtros */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <span className="font-medium">{t("filters.title")}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder={t("filters.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <Select value={filterType} onValueChange={(v: "todos" | LogType) => setFilterType(v)}>
            <SelectTrigger>
              <SelectValue placeholder={t("filters.type")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">{t("filters.allTypes")}</SelectItem>
              {([...new Set(logs.map((l) => l.type))] as LogType[]).map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {iconosPorTipo[tipo]} {t(`types.${tipo}` as const)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterRead}
            onValueChange={(v: "todos" | "no_leidas" | "leidas") => setFilterRead(v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("filters.readState")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">{t("filters.read.all")}</SelectItem>
              <SelectItem value="no_leidas">❗ {t("filters.read.unread")}</SelectItem>
              <SelectItem value="leidas">✅ {t("filters.read.read")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">📭 {t("empty.title")}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {search || filterType !== "todos" || filterRead !== "todos"
              ? t("empty.hintFiltered")
              : t("empty.hint")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const mensaje = friendlyMessage(log);
            const timeAgo = formatTimeAgo(tsToDate(log.timestamp));

            return (
              <Card
                key={log.id}
                className={[
                  "p-4 transition-all duration-200 hover:shadow-md border",
                  !log.readByClient
                    ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-l-amber-500 dark:border-l-amber-400"
                    : "bg-card text-card-foreground border-border opacity-90 hover:opacity-100",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-2xl">{iconosPorTipo[log.type]}</div>
                      {!log.readByClient && (
                        <div className="w-3 h-3 bg-amber-500 dark:bg-amber-400 rounded-full animate-pulse"></div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-medium">{mensaje}</p>

                        {!log.readByClient && (
                          <Badge
                            variant="secondary"
                            className="bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100 text-xs font-medium"
                          >
                            📌 {t("badges.unread")}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{timeAgo}</span>
                        </div>
                        <span>👤 {log.admin}</span>
                        <span className="hidden sm:inline">
                          📅 {formatTs(log.timestamp, "dd/MM/yyyy HH:mm", dfLocale)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!log.readByClient && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsRead(log.id)}
                      className="text-amber-800 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:text-amber-100 dark:hover:bg-amber-900/30 shrink-0"
                    >
                      {t("markRead")}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {filteredLogs.length > 0 && (
        <Card className="p-4 bg-card text-card-foreground border-border">
          <div className="text-center text-sm text-muted-foreground">
            {t("footer", { count: filteredLogs.length, total: logs.length })}
          </div>
        </Card>
      )}
    </div>
  );
}
