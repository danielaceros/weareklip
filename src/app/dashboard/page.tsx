"use client";

import { useEffect, useState, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { es as dfnsEs, enUS as dfnsEn } from "date-fns/locale";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  type Timestamp,
  type CollectionReference,
} from "firebase/firestore";
import { useT } from "@/lib/i18n";
import { useLocale } from "next-intl";

type SubscriptionStatus =
  | "loading"
  | "active"
  | "trialing"
  | "incomplete"
  | "canceled"
  | "no_active";

type Estado = "por_hacer" | "en_proceso" | "completado";

type Evento = {
  id: string;
  tipo: "guion" | "video";
  titulo: string;
  fecha: string;
  estado: Estado;
  refId: string;
};

type UltimoGuion = {
  id: string;
  titulo: string;
  contenido: string;
  estado: number;
  createdAt?: string;
};

type UltimoVideo = {
  id: string;
  titulo: string;
  url: string;
  estado: number;
  createdAt?: string;
};

interface DashboardStats {
  subscripcion: {
    status: SubscriptionStatus;
    plan: string;
    renovacion: string;
  };
  guiones: {
    nuevos: number;
    cambios: number;
    aprobados: number;
  };
  videos: number;
}

/* --------- Tipos de documentos Firestore (para evitar any) --------- */
type CalendarioDoc = {
  tipo: "guion" | "video";
  titulo: string;
  fecha: Timestamp;             // Firestore Timestamp
  estado?: Estado;
  refId: string;
};

type GuionDoc = {
  titulo?: string;
  contenido?: string;
  estado?: number;              // 0,1,2
  creadoEn?: string;            // lo dejas como llega (string/ISO/epoch)
};

type VideoDoc = {
  titulo?: string;
  url?: string;
  estado?: number | string;     // a veces string en BBDD -> lo normalizamos
  creadoEn?: string;
};
/* ------------------------------------------------------------------- */

function formatDateToISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DashboardPage() {
  const t = useT();
  const locale = useLocale(); // 'es' | 'en'
  const dfnsLocale = locale === "es" ? dfnsEs : dfnsEn;
  const isES = locale === "es";

  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Date | undefined>(undefined);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [ultimoGuion, setUltimoGuion] = useState<UltimoGuion | null>(null);
  const [ultimoVideo, setUltimoVideo] = useState<UltimoVideo | null>(null);
  const [, setStats] = useState<DashboardStats>({
    subscripcion: {
      status: "loading",
      plan: t("dashboard.subscription.unknownPlan"),
      renovacion: t("dashboard.subscription.unknownRenewal"),
    },
    guiones: { nuevos: 0, cambios: 0, aprobados: 0 },
    videos: 0,
  });

  const router = useRouter();

  const fetchEventos = useCallback(async (uid: string) => {
    try {
      const colRef = collection(
        db,
        "users",
        uid,
        "calendario"
      ) as CollectionReference<CalendarioDoc>;

      const snap = await getDocs(colRef);
      const data: Evento[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const fechaDate = d.fecha.toDate();
        return {
          id: docSnap.id,
          tipo: d.tipo,
          titulo: d.titulo,
          fecha: formatDateToISO(fechaDate),
          estado: (d.estado ?? "por_hacer") as Estado,
          refId: d.refId,
        };
      });
      setEventos(data);
    } catch (error) {
      console.error("Error cargando eventos:", error);
    }
  }, []);

  const fetchUltimoGuion = useCallback(
    async (uid: string) => {
      try {
        const colRef = collection(
          db,
          "users",
          uid,
          "guiones"
        ) as CollectionReference<GuionDoc>;

        const qy = query(colRef, orderBy("creadoEn", "desc"), limit(1));
        const snap = await getDocs(qy);

        if (!snap.empty) {
          const docSnap = snap.docs[0];
          const data = docSnap.data();
          setUltimoGuion({
            id: docSnap.id,
            titulo: data.titulo ?? t("scripts.untitled"),
            contenido: data.contenido ?? "",
            estado: data.estado ?? 0,
            createdAt: data.creadoEn,
          });
          return;
        }

        // Fallback sin ordenar
        const snapFallback = await getDocs(colRef);
        if (!snapFallback.empty) {
          const docSnap = snapFallback.docs[0];
          const data = docSnap.data();
          setUltimoGuion({
            id: docSnap.id,
            titulo: data.titulo ?? t("scripts.untitled"),
            contenido: data.contenido ?? "",
            estado: data.estado ?? 0,
            createdAt: data.creadoEn,
          });
        }
      } catch (error) {
        console.error("Error cargando último guión:", error);
      }
    },
    [t]
  );

  const fetchUltimoVideo = useCallback(
    async (uid: string) => {
      try {
        const colRef = collection(
          db,
          "users",
          uid,
          "videos"
        ) as CollectionReference<VideoDoc>;

        const qy = query(colRef, orderBy("creadoEn", "desc"), limit(1));
        const snap = await getDocs(qy);

        if (!snap.empty) {
          const docSnap = snap.docs[0];
          const data = docSnap.data();
          setUltimoVideo({
            id: docSnap.id,
            titulo: data.titulo ?? t("videos.untitled"),
            url: data.url ?? "",
            estado: Number(data.estado ?? 0),
            createdAt: data.creadoEn,
          });
          return;
        }

        // Fallback sin ordenar
        const snapFallback = await getDocs(colRef);
        if (!snapFallback.empty) {
          const docSnap = snapFallback.docs[0];
          const data = docSnap.data();
          setUltimoVideo({
            id: docSnap.id,
            titulo: data.titulo ?? t("videos.untitled"),
            url: data.url ?? "",
            estado: Number(data.estado ?? 0),
            createdAt: data.creadoEn,
          });
        }
      } catch (error) {
        console.error("Error cargando último video:", error);
      }
    },
    [t]
  );

  const fetchStats = useCallback(async (uid: string) => {
    try {
      const guionesCol = collection(
        db,
        "users",
        uid,
        "guiones"
      ) as CollectionReference<GuionDoc>;
      const guionesSnap = await getDocs(guionesCol);

      let nuevos = 0,
        cambios = 0,
        aprobados = 0;

      guionesSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const estado = data.estado ?? 0;
        if (estado === 0) nuevos++;
        else if (estado === 1) cambios++;
        else if (estado === 2) aprobados++;
      });

      const videosCol = collection(
        db,
        "users",
        uid,
        "videos"
      ) as CollectionReference<VideoDoc>;
      const videosSnap = await getDocs(videosCol);
      const totalVideos = videosSnap.size;

      setStats((prev) => ({
        ...prev,
        guiones: { nuevos, cambios, aprobados },
        videos: totalVideos,
      }));
    } catch (error) {
      console.error("Error cargando estadísticas:", error);
    }
  }, []);

  const fetchData = useCallback(
    async (user: User) => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/stripe/subscription", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();

        setStats((prev) => ({
          ...prev,
          subscripcion: {
            status: (data.status ?? "no_active") as SubscriptionStatus,
            plan: data.plan ?? t("dashboard.subscription.unknownPlan"),
            renovacion: data.current_period_end
              ? new Date(data.current_period_end * 1000).toLocaleDateString(
                  isES ? "es-ES" : "en-US"
                )
              : t("dashboard.subscription.unknownRenewal"),
          },
        }));

        await Promise.all([
          fetchEventos(user.uid),
          fetchUltimoGuion(user.uid),
          fetchUltimoVideo(user.uid),
          fetchStats(user.uid),
        ]);
      } catch (error) {
        console.error("Error al cargar dashboard:", error);
        toast.error(t("dashboard.subscription.loadError"), {
          description: t("dashboard.subscription.unknown"),
          duration: 8000,
        });

        setStats((prev) => ({
          ...prev,
          subscripcion: {
            status: "no_active",
            plan: t("dashboard.subscription.none"),
            renovacion: t("dashboard.subscription.unknownRenewal"),
          },
        }));
      } finally {
        setLoading(false);
      }
    },
    [fetchEventos, fetchUltimoGuion, fetchUltimoVideo, fetchStats, t, isES]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        toast.error(t("dashboard.authError.title"), {
          description: t("dashboard.authError.description"),
        });
        setLoading(false);
        return;
      }
      fetchData(user);
    });
    return () => unsubscribe();
  }, [fetchData, t]);

  // ======== Agregación de calendario por día ========
  type DiaInfo = { estado: Estado | null; cantidad: number };
  const eventosPorDia: Record<string, DiaInfo> = {};

  eventos.forEach((evento) => {
    const fecha = evento.fecha;
    if (!eventosPorDia[fecha]) {
      eventosPorDia[fecha] = { estado: evento.estado, cantidad: 1 };
    } else {
      eventosPorDia[fecha].cantidad += 1;
      const estados: (Estado | null)[] = [eventosPorDia[fecha].estado, evento.estado];
      if (estados.includes("por_hacer")) {
        eventosPorDia[fecha].estado = "por_hacer";
      } else if (estados.includes("en_proceso")) {
        eventosPorDia[fecha].estado = "en_proceso";
      } else {
        eventosPorDia[fecha].estado = "completado";
      }
    }
  });

  const fechasPorHacer: Date[] = [];
  const fechasEnProceso: Date[] = [];
  const fechasCompletado: Date[] = [];

  Object.entries(eventosPorDia).forEach(([fechaISO, info]) => {
    const [year, month, day] = fechaISO.split("-").map(Number);
    const fecha = new Date(year, month - 1, day);
    if (info.estado === "por_hacer") fechasPorHacer.push(fecha);
    else if (info.estado === "en_proceso") fechasEnProceso.push(fecha);
    else if (info.estado === "completado") fechasCompletado.push(fecha);
  });

  const eventosDelDia = selected
    ? eventos.filter((e) => e.fecha === formatDateToISO(selected))
    : [];

  // Badge de estado (traducido)
  const getEstadoBadge = (estado: number) => {
    switch (estado) {
      case 0:
        return <Badge className="bg-red-500 text-white">{t("status.new")}</Badge>;
      case 1:
        return (
          <Badge className="bg-yellow-400 text-black">{t("status.changes")}</Badge>
        );
      case 2:
        return (
          <Badge className="bg-green-500 text-white">{t("status.approved")}</Badge>
        );
      default:
        return <Badge variant="secondary">{t("common.unknown")}</Badge>;
    }
  };

  const weekdayLabels = isES
    ? ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"]
    : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground animate-pulse">
        <p className="text-lg">🔄 {t("dashboard.loading")}</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .event-day-por-hacer { background-color: #fee2e2 !important; border-radius: 0.375rem !important; }
        .event-day-en-proceso { background-color: #ffedd5 !important; border-radius: 0.375rem !important; }
        .event-day-completado { background-color: #dcfce7 !important; border-radius: 0.375rem !important; }
        .rdp-day_selected:not([disabled]) { background-color: #3b82f6 !important; color: white !important; border-radius: 0.375rem !important; }
        @media (max-width: 1024px) {
          .rdp { font-size: 0.875rem; }
          .rdp-table { max-width: 100%; width: 100%; }
          .rdp-cell { width: 2rem; height: 2rem; }
          .rdp-button { width: 1.75rem; height: 1.75rem; font-size: 0.75rem; }
        }
        @media (max-width: 640px) {
          .rdp { font-size: 0.75rem; }
          .rdp-cell { width: 1.5rem; height: 1.5rem; }
          .rdp-button { width: 1.25rem; height: 1.25rem; font-size: 0.625rem; }
        }
        .video-container { position: relative; width: 100%; max-width: 250px; margin: 0 auto; background: #f3f4f6; border-radius: 0.5rem; overflow: hidden; }
        .video-container.vertical { aspect-ratio: 9/16; }
        .video-container video { width: 100%; height: 100%; object-fit: cover; }
      `}</style>

      <div className="p-6 space-y-8">
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Calendario */}
          <Card className="p-3 lg:p-4">
            <h2 className="font-semibold text-base lg:text-lg mb-3">
              📅 {t("dashboard.calendar.title")}
            </h2>
            <div className="space-y-3 lg:space-y-4">
              <div className="w-full overflow-hidden">
                <DayPicker
                  mode="single"
                  selected={selected}
                  onSelect={setSelected}
                  modifiers={{
                    porHacer: fechasPorHacer,
                    enProceso: fechasEnProceso,
                    completado: fechasCompletado,
                  }}
                  modifiersClassNames={{
                    porHacer: "event-day-por-hacer",
                    enProceso: "event-day-en-proceso",
                    completado: "event-day-completado",
                  }}
                  locale={dfnsLocale}
                  fixedWeeks
                  pagedNavigation
                  showOutsideDays
                  className="text-left text-xs lg:text-sm mx-auto"
                  formatters={{
                    formatWeekdayName: (weekday) => {
                      return weekdayLabels[weekday.getDay()];
                    },
                  }}
                />
              </div>

              {/* Eventos del día seleccionado */}
              {selected && (
                <div>
                  <h4 className="font-medium text-sm mb-2">
                    {selected.toLocaleDateString(isES ? "es-ES" : "en-US")}
                  </h4>
                  {eventosDelDia.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      {t("dashboard.calendar.noDeliveries")}
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {eventosDelDia.map((e) => {
                        let estadoColor = "";
                        switch (e.estado) {
                          case "por_hacer":
                            estadoColor = "bg-red-100 text-red-800";
                            break;
                          case "en_proceso":
                            estadoColor = "bg-orange-100 text-orange-800";
                            break;
                          case "completado":
                            estadoColor = "bg-green-100 text-green-800";
                            break;
                        }

                        return (
                          <div key={e.id} className={`text-xs p-2 rounded ${estadoColor}`}>
                            <span>{e.tipo === "guion" ? "📜" : "🎬"} {e.titulo}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Leyenda */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 bg-red-200 rounded"></div>
                  <span>{t("dashboard.calendar.legend.todo")}</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 bg-orange-200 rounded"></div>
                  <span>{t("dashboard.calendar.legend.inProgress")}</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 bg-green-200 rounded"></div>
                  <span>{t("dashboard.calendar.legend.done")}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Último Guión */}
          <Card className="p-3 lg:p-4">
            <h2 className="font-semibold text-base lg:text-lg mb-3">
              📜 {t("dashboard.latestScript.title")}
            </h2>
            <div className="space-y-3 lg:space-y-4">
              {ultimoGuion ? (
                <>
                  <div>
                    <h3 className="font-medium text-base mb-2 line-clamp-2">
                      {ultimoGuion.titulo}
                    </h3>
                    <div className="mb-3">{getEstadoBadge(ultimoGuion.estado)}</div>
                    <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                      {ultimoGuion.contenido.substring(0, 150)}
                      {ultimoGuion.contenido.length > 150 ? "..." : ""}
                    </p>
                  </div>
                  <Button
                    onClick={() => router.push("/dashboard/scripts")}
                    className="w-full"
                    variant="outline"
                  >
                    {t("dashboard.latestScript.viewAll")}
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500 mb-4">
                      📄 {t("dashboard.latestScript.emptyTitle")}
                    </p>
                    <p className="text-xs text-gray-400">
                      {t("dashboard.latestScript.emptySubtitle")}
                    </p>
                  </div>
                  <Button
                    onClick={() => router.push("/dashboard/scripts")}
                    className="w-full"
                    variant="outline"
                  >
                    {t("dashboard.latestScript.view")}
                  </Button>
                </>
              )}
            </div>
          </Card>

          {/* Último Video */}
          <Card className="p-3 lg:p-4">
            <h2 className="font-semibold text-base lg:text-lg mb-3">
              🎬 {t("dashboard.latestVideo.title")}
            </h2>
            <div className="space-y-3 lg:space-y-4">
              {ultimoVideo ? (
                <>
                  <div>
                    <h3 className="font-medium text-base mb-2 line-clamp-2">
                      {ultimoVideo.titulo}
                    </h3>
                    <div className="mb-3">{getEstadoBadge(ultimoVideo.estado)}</div>
                    {ultimoVideo.url && (
                      <div className="mb-4">
                        <div className="video-container vertical">
                          <video controls src={ultimoVideo.url} preload="metadata" className="rounded" />
                        </div>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => router.push("/dashboard/videos")}
                    className="w-full"
                    variant="outline"
                  >
                    {t("dashboard.latestVideo.viewAll")}
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500 mb-4">
                      🎥 {t("dashboard.latestVideo.emptyTitle")}
                    </p>
                    <p className="text-xs text-gray-400">
                      {t("dashboard.latestVideo.emptySubtitle")}
                    </p>
                  </div>
                  <Button
                    onClick={() => router.push("/dashboard/videos")}
                    className="w-full"
                    variant="outline"
                  >
                    {t("dashboard.latestVideo.view")}
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
