// app/dashboard/notifications/page.tsx
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
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { handleError, showSuccess } from "@/lib/errors";
import { Bell, CheckCircle, Clock, Filter } from "lucide-react";

type Log = {
  id: string;
  type: "guion" | "video" | "clonacion" | "tarea" | "sistema";
  action: string;
  uid: string;
  admin: string;
  message: string;
  timestamp: { seconds: number; nanoseconds: number };
  readByClient: boolean;
};

const iconosPorTipo: Record<string, string> = {
  guion: "📜",
  video: "🎥",
  clonacion: "📦",
  tarea: "🧾",
  sistema: "⚙️",
};

const mensajesAmigables: Record<string, (message: string) => string> = {
  guion: (message: string) => {
    if (message.includes("aprobó")) return "✅ Tu guión fue aprobado";
    if (message.includes("editó")) return "✏️ Tu guión fue editado";
    if (message.includes("creó")) return "📝 Se creó un nuevo guión para ti";
    if (message.includes("solicitó cambios"))
      return "💬 Solicitaste cambios en tu guión";
    return message;
  },
  video: (message: string) => {
    if (message.includes("aprobó video")) return "✅ Tu video fue aprobado";
    if (message.includes("subió"))
      return "🎥 Hay un nuevo video disponible para ti";
    if (message.includes("editado")) return "✏️ Tu video fue editado";
    if (message.includes("solicitó cambios en video"))
      return "💬 Solicitaste cambios en tu video";
    return message;
  },
  clonacion: (message: string) => {
    if (message.includes("subió")) return "📦 Subiste material de clonación";
    if (message.includes("procesado")) return "✅ Tu clonación fue procesada";
    return message;
  },
  tarea: (message: string) => {
    if (message.includes("completada")) return "✅ Completaste una tarea";
    if (message.includes("asignada")) return "📋 Se te asignó una nueva tarea";
    return message;
  },
  sistema: (message: string) => {
    if (message.includes("mantenimiento")) return "🔧 Mantenimiento programado";
    if (message.includes("actualización")) return "🆙 Sistema actualizado";
    return message;
  },
};

export default function UserNotificationsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("todos");
  const [filterRead, setFilterRead] = useState("todos");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        handleError(null, "Inicia sesión para ver tus notificaciones");
        setLoading(false);
        return;
      }

      setUserId(user.uid);
      setupRealTimeListener(user.uid);
    });

    return () => unsubscribe();
  }, []);

  const setupRealTimeListener = (uid: string) => {
    const q = query(
      collection(db, "logs"),
      where("uid", "==", uid),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedLogs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Log[];

        setLogs(fetchedLogs);
        setLastUpdate(new Date());
        setLoading(false);
      },
      (error) => {
        console.error("Error en tiempo real:", error);
        handleError(error, "Error en actualizaciones en tiempo real");
        setLoading(false);
      }
    );

    return unsubscribe;
  };

  const markAsRead = async (logId: string) => {
    if (!userId) return;

    try {
      setLogs((prevLogs) =>
        prevLogs.map((log) =>
          log.id === logId ? { ...log, readByClient: true } : log
        )
      );

      await updateDoc(doc(db, "logs", logId), {
        readByClient: true,
      });

      showSuccess("Marcado como leído");
    } catch (error) {
      setLogs((prevLogs) =>
        prevLogs.map((log) =>
          log.id === logId ? { ...log, readByClient: false } : log
        )
      );
      handleError(error, "Error al marcar como leído");
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;

    const unreadLogs = filteredLogs.filter((log) => !log.readByClient);
    if (unreadLogs.length === 0) return;

    try {
      setLogs((prevLogs) =>
        prevLogs.map((log) => ({ ...log, readByClient: true }))
      );

      const promises = unreadLogs.map((log) =>
        updateDoc(doc(db, "logs", log.id), { readByClient: true })
      );
      await Promise.all(promises);

      showSuccess(`${unreadLogs.length} notificaciones marcadas como leídas`);
    } catch (error) {
      setupRealTimeListener(userId);
      handleError(error, "Error al marcar todas como leídas");
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Ahora mismo";
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    return `Hace ${diffDays} días`;
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

  const tiposUnicos = [...new Set(logs.map((log) => log.type))];

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

  const unreadCount = logs.filter((log) => !log.readByClient).length;
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
            <h1 className="text-2xl font-bold">Mis Notificaciones</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} sin leer • ${stats.today} hoy`
                : "Todo al día ✨"}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button onClick={markAllAsRead} size="sm">
              <CheckCircle className="w-4 h-4 mr-2" />
              Marcar todas como leídas
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{stats.unread}</div>
          <div className="text-sm text-muted-foreground">Sin leer</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.today}</div>
          <div className="text-sm text-muted-foreground">Hoy</div>
        </Card>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span>
          Última actualización: {formatTimeAgo(lastUpdate)} • 🟢 Actualizaciones
          en tiempo real
        </span>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filtros</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="🔍 Buscar notificaciones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {tiposUnicos.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {iconosPorTipo[tipo]} {tipo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterRead} onValueChange={setFilterRead}>
            <SelectTrigger>
              <SelectValue placeholder="Estado de lectura" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="no_leidas">❗ No leídas</SelectItem>
              <SelectItem value="leidas">✅ Leídas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            📭 No tienes notificaciones
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {search || filterType !== "todos" || filterRead !== "todos"
              ? "Ajusta los filtros para ver más resultados"
              : "Cuando haya actualizaciones en tus proyectos, aparecerán aquí"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const mensaje = mensajesAmigables[log.type]
              ? mensajesAmigables[log.type](log.message)
              : log.message;

            const timeAgo = formatTimeAgo(
              new Date(log.timestamp.seconds * 1000)
            );

            return (
              <Card
                key={log.id}
                className={`p-4 transition-all duration-200 hover:shadow-md ${
                  !log.readByClient
                    ? "border-yellow-300 bg-yellow-50 shadow-md border-l-4 border-l-yellow-500"
                    : "bg-white border-gray-200 opacity-90 hover:opacity-100"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-2xl">{iconosPorTipo[log.type]}</div>
                      {!log.readByClient && (
                        <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-medium">{mensaje}</p>

                        {!log.readByClient && (
                          <Badge
                            variant="secondary"
                            className="bg-yellow-200 text-yellow-800 text-xs font-medium"
                          >
                            📌 Sin leer
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
                          📅{" "}
                          {format(
                            new Date(log.timestamp.seconds * 1000),
                            "dd/MM/yyyy HH:mm",
                            {
                              locale: es,
                            }
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!log.readByClient && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsRead(log.id)}
                      className="text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100 shrink-0"
                    >
                      Marcar como leída
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {filteredLogs.length > 0 && (
        <Card className="p-4">
          <div className="text-center text-sm text-muted-foreground">
            Mostrando {filteredLogs.length} de {logs.length} notificaciones • 🟢
            Actualizaciones en tiempo real
          </div>
        </Card>
      )}
    </div>
  );
}
