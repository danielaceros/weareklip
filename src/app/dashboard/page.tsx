// src/app/(dashboard)/dashboard/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { es as dfnsEs, enUS as dfnsEn, fr as dfnsFr } from "date-fns/locale";
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

type CalendarioDoc = {
  tipo: "guion" | "video";
  titulo: string;
  fecha: Timestamp;
  estado?: Estado;
  refId: string;
};

type GuionDoc = {
  titulo?: string;
  contenido?: string;
  estado?: number;
  creadoEn?: string;
};

type VideoDoc = {
  titulo?: string;
  url?: string;
  estado?: number | string;
  creadoEn?: string;
};

function formatDateToISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function DashboardPage() {
  const t = useT();
  const router = useRouter();
  const locale = useLocale();
  const dfnsLocale =
    locale === "fr" ? dfnsFr : locale === "es" ? dfnsEs : dfnsEn;
  const displayLocale =
    locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-US";
  const langLabel = (locale || "es").toUpperCase();

  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Date | undefined>();
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
    } catch (e) {
      console.error("Error cargando eventos:", e);
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

        const useDoc = !snap.empty
          ? snap.docs[0]
          : (await getDocs(colRef)).docs[0];
        if (useDoc) {
          const data = useDoc.data();
          setUltimoGuion({
            id: useDoc.id,
            titulo: data.titulo ?? t("scripts.untitled"),
            contenido: data.contenido ?? "",
            estado: data.estado ?? 0,
            createdAt: data.creadoEn,
          });
        }
      } catch (e) {
        console.error("Error cargando último guión:", e);
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

        const useDoc = !snap.empty
          ? snap.docs[0]
          : (await getDocs(colRef)).docs[0];
        if (useDoc) {
          const data = useDoc.data();
          setUltimoVideo({
            id: useDoc.id,
            titulo: data.titulo ?? t("videos.untitled"),
            url: data.url ?? "",
            estado: Number(data.estado ?? 0),
            createdAt: data.creadoEn,
          });
        }
      } catch (e) {
        console.error("Error cargando último video:", e);
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
        const estado = docSnap.data().estado ?? 0;
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
    } catch (e) {
      console.error("Error cargando estadísticas:", e);
    }
  }, []);

  const fetchData = useCallback(
    async (user: User) => {
      try {
        // Si tienes API de suscripción, déjalo. Si no, ignora el error y muestra "none".
        const token = await user.getIdToken().catch(() => null);
        if (token) {
          const res = await fetch("/api/stripe/subscription", {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => null);

          if (res && res.ok) {
            const data = await res.json();
            setStats((prev) => ({
              ...prev,
              subscripcion: {
                status: (data.status ?? "no_active") as SubscriptionStatus,
                plan: data.plan ?? t("dashboard.subscription.unknownPlan"),
                renovacion: data.current_period_end
                  ? new Date(data.current_period_end * 1000).toLocaleDateString(
                      displayLocale
                    )
                  : t("dashboard.subscription.unknownRenewal"),
              },
            }));
          } else {
            setStats((prev) => ({
              ...prev,
              subscripcion: {
                status: "no_active",
                plan: t("dashboard.subscription.none"),
                renovacion: t("dashboard.subscription.unknownRenewal"),
              },
            }));
          }
        }

        await Promise.all([
          fetchEventos(user.uid),
          fetchUltimoGuion(user.uid),
          fetchUltimoVideo(user.uid),
          fetchStats(user.uid),
        ]);
      } catch (e) {
        console.error("Error al cargar dashboard:", e);
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
    [
      fetchEventos,
      fetchUltimoGuion,
      fetchUltimoVideo,
      fetchStats,
      t,
      displayLocale,
    ]
  );

  // Redirección si no hay sesión
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        toast.error(t("dashboard.authError.title"), {
          description: t("dashboard.authError.description"),
        });
        router.replace("/login");
        setLoading(false);
        return;
      }
      fetchData(user);
    });
    return () => unsub();
  }, [router, fetchData, t]);

  // ======== Agregación por días del calendario ========
  type DiaInfo = { estado: Estado | null; cantidad: number };
  const eventosPorDia: Record<string, DiaInfo> = {};
  eventos.forEach((ev) => {
    const k = ev.fecha;
    if (!eventosPorDia[k])
      eventosPorDia[k] = { estado: ev.estado, cantidad: 1 };
    else {
      eventosPorDia[k].cantidad += 1;
      const estados: (Estado | null)[] = [eventosPorDia[k].estado, ev.estado];
      if (estados.includes("por_hacer")) eventosPorDia[k].estado = "por_hacer";
      else if (estados.includes("en_proceso"))
        eventosPorDia[k].estado = "en_proceso";
      else eventosPorDia[k].estado = "completado";
    }
  });

  const fechasPorHacer: Date[] = [];
  const fechasEnProceso: Date[] = [];
  const fechasCompletado: Date[] = [];
  Object.entries(eventosPorDia).forEach(([iso, info]) => {
    const [y, m, d] = iso.split("-").map(Number);
    const fecha = new Date(y, m - 1, d);
    if (info.estado === "por_hacer") fechasPorHacer.push(fecha);
    else if (info.estado === "en_proceso") fechasEnProceso.push(fecha);
    else if (info.estado === "completado") fechasCompletado.push(fecha);
  });

  const eventosDelDia = selected
    ? eventos.filter((e) => e.fecha === formatDateToISO(selected))
    : [];

  const getEstadoBadge = (estado: number) => {
    if (estado === 0)
      return <Badge className="bg-red-500 text-white">{t("status.new")}</Badge>;
    if (estado === 1)
      return (
        <Badge className="bg-yellow-400 text-black">
          {t("status.changes")}
        </Badge>
      );
    if (estado === 2)
      return (
        <Badge className="bg-green-500 text-white">
          {t("status.approved")}
        </Badge>
      );
    return <Badge variant="secondary">{t("common.unknown")}</Badge>;
  };

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
      `}</style>

      <div className="p-6 space-y-8">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
          <Badge variant="outline" className="uppercase" title="Idioma">
            {(langLabel as string) || "ES"}
          </Badge>
        </div>
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
                />
              </div>

              {selected && (
                <div>
                  <h4 className="font-medium text-sm mb-2">
                    {selected.toLocaleDateString(displayLocale)}
                  </h4>
                  {eventosDelDia.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      {t("dashboard.calendar.noDeliveries")}
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {eventosDelDia.map((e) => {
                        const color =
                          e.estado === "por_hacer"
                            ? "bg-red-100 text-red-800"
                            : e.estado === "en_proceso"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-green-100 text-green-800";
                        return (
                          <div
                            key={e.id}
                            className={`text-xs p-2 rounded ${color}`}
                          >
                            <span>
                              {e.tipo === "guion" ? "📜" : "🎬"} {e.titulo}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

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

          {/* Último Guion */}
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
                    <div className="mb-3">
                      {getEstadoBadge(ultimoGuion.estado)}
                    </div>
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
                    <div className="mb-3">
                      {getEstadoBadge(ultimoVideo.estado)}
                    </div>
                    {ultimoVideo.url && (
                      <div className="mb-4">
                        <div className="video-container vertical">
                          <video
                            controls
                            src={ultimoVideo.url}
                            preload="metadata"
                            className="rounded"
                          />
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
