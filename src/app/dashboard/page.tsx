"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase"; // <-- db eliminado
import { onAuthStateChanged, type User } from "firebase/auth";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollText, Clapperboard } from "lucide-react"; // <-- CalendarFold eliminado
import { useT } from "@/lib/i18n";
import { Locale, useLocale } from "next-intl";
import QuickActionsCard from "@/components/dashboard/QuickActionsCard";

// -------- Types que sí usamos --------
type SubscriptionStatus =
  | "loading"
  | "active"
  | "trialing"
  | "incomplete"
  | "canceled"
  | "no_active";

type GuionDoc = {
  titulo?: string;
  contenido?: string;
  estado?: number;
  creadoEn?: any;
  createdAt?: any;
  updatedAt?: any;
  lang?: Locale;
  notas?: string;
};
type Guion = GuionDoc & { id: string };

type VideoDoc = {
  titulo?: string;
  url?: string;
  estado?: number | string;
  creadoEn?: any;
  createdAt?: any;
  updatedAt?: any;
};
type Video = VideoDoc & { id: string };

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
  guiones: { nuevos: number; cambios: number; aprobados: number };
  videos: number;
}

// -------- Utils que sí usamos --------
function asMillis(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Date.parse(v);
    return Number.isNaN(n) ? 0 : n;
  }
  if (typeof v === "object") {
    if (typeof v.seconds === "number") return v.seconds * 1000;
    if (typeof v.toDate === "function") return v.toDate().getTime();
  }
  return 0;
}
function bestTime(d: { updatedAt?: any; creadoEn?: any; createdAt?: any }) {
  return asMillis(d.updatedAt ?? d.creadoEn ?? d.createdAt);
}

// -------- Component --------
export default function DashboardPage() {
  const t = useT();
  const router = useRouter();
  const locale = useLocale();

  // ⚠️ dfnsLocale eliminado; mantenemos displayLocale
  const displayLocale =
    locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-US";
  const langLabel = (locale || "es").toUpperCase();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [loading, setLoading] = useState(true);
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

  // 🔥 Último guion
  const fetchUltimoGuion = useCallback(
    async (uid: string) => {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return;

        const res = await fetch(
          `/api/firebase/users/${uid}/scripts?limit=1&order=desc`,
          { headers: { Authorization: `Bearer ${idToken}` } }
        );
        if (!res.ok) throw new Error("Error al cargar guiones");

        type GuionApi = {
          id: string;
          title?: string;
          titulo?: string;
          description?: string;
          content?: string;
          contenido?: string;
          script?: string;
          status?: number | string;
          estado?: number | string;
          createdAt?: number | string;
          creadoEn?: number | string;
        };

        const docs: GuionApi[] = await res.json();
        const d = docs[0];
        if (!d) return;

        const titulo =
          d.titulo ?? d.title ?? d.description ?? t("scripts.untitled");

        const contenido =
          d.contenido ?? d.script ?? d.content ?? d.description ?? "";

        const estadoRaw = d.estado ?? d.status ?? 0;
        const estado =
          typeof estadoRaw === "string"
            ? ["new", "nuevo"].includes(estadoRaw)
              ? 0
              : ["changes", "cambios"].includes(estadoRaw)
              ? 1
              : ["approved", "aprobado", "aprobada"].includes(estadoRaw)
              ? 2
              : 0
            : Number(estadoRaw);

        setUltimoGuion({
          id: d.id,
          titulo,
          contenido,
          estado,
          createdAt: String(d.creadoEn ?? d.createdAt ?? ""),
        });
      } catch (e) {
        console.error("Error cargando último guion:", e);
      }
    },
    [t]
  );

  // 🔥 Último vídeo
  const fetchUltimoVideo = useCallback(
    async (uid: string) => {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return;

        const res = await fetch(
          `/api/firebase/users/${uid}/videos?limit=1&order=desc`,
          { headers: { Authorization: `Bearer ${idToken}` } }
        );
        if (!res.ok) throw new Error("Error al cargar videos");

        const docs = await res.json();
        const useDoc = docs?.[0];
        if (!useDoc) return;

        const titulo = useDoc.titulo ?? useDoc.title ?? t("videos.untitled");
        const url = useDoc.url ?? useDoc.videoUrl ?? "";

        const statusRaw = (useDoc.estado ?? useDoc.status ?? "processing") as
          | string
          | number;
        const estado =
          typeof statusRaw === "number"
            ? statusRaw
            : statusRaw === "approved"
            ? 2
            : statusRaw === "changes" || statusRaw === "requires_changes"
            ? 1
            : 0;

        setUltimoVideo({
          id: useDoc.id,
          titulo,
          url,
          estado,
          createdAt: useDoc.creadoEn ?? useDoc.createdAt,
        });
      } catch (e) {
        console.error("Error cargando último video:", e);
      }
    },
    [t]
  );

  // Stats (guiones/vídeos)
  const fetchStats = useCallback(async (uid: string) => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return;
      const [resGuiones, resVideos] = await Promise.all([
        fetch(`/api/firebase/users/${uid}/scripts`, {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        }),
        fetch(`/api/firebase/users/${uid}/videos`, {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        }),
      ]);
      if (!resGuiones.ok || !resVideos.ok)
        throw new Error("Error cargando stats");
      const guiones: Guion[] = await resGuiones.json();
      const videos: Video[] = await resVideos.json();

      let nuevos = 0,
        cambios = 0,
        aprobados = 0;
      guiones.forEach((g) => {
        const estado = Number(g.estado ?? 0);
        if (estado === 0) nuevos++;
        else if (estado === 1) cambios++;
        else if (estado === 2) aprobados++;
      });

      setStats((prev) => ({
        ...prev,
        guiones: { nuevos, cambios, aprobados },
        videos: videos.length,
      }));
    } catch (e) {
      console.error("Error cargando estadísticas:", e);
    }
  }, []);

  // Carga general
  const fetchData = useCallback(
    async (user: User) => {
      try {
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
          }
        }

        await Promise.allSettled([
          fetchUltimoGuion(user.uid),
          fetchUltimoVideo(user.uid),
          fetchStats(user.uid),
        ]);
      } catch (e) {
        console.error("Error al cargar dashboard:", e);
        toast.error(t("dashboard.subscription.loadError"));
      } finally {
        setLoading(false);
      }
    },
    [fetchUltimoGuion, fetchUltimoVideo, fetchStats, t, displayLocale]
  );

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        toast.error(t("dashboard.authError.title"));
        router.replace("/login");
        setLoading(false);
        return;
      }
      if (sessionId) {
        toast.success("🎉 Prueba iniciada con éxito");
        router.replace("/dashboard");
      }
      fetchData(user);
    });
    return () => unsub();
  }, [router, fetchData, t, sessionId]);

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

  const SpinnerEllipsis = () => (
    <div className="flex justify-center items-center gap-1">
      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" />
    </div>
  );

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <SpinnerEllipsis />
        <p className="mt-3 text-lg">{t("dashboard.loading")}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        <Badge variant="outline" className="uppercase" title="Idioma">
          {(langLabel as string) || "ES"}
        </Badge>
      </div>
      <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>

      {/* ✅ Acciones rápidas */}
      <QuickActionsCard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Último Guion */}
        <Card className="p-3 lg:p-4">
          <h2 className="font-semibold text-base lg:text-lg mb-3 flex items-center gap-2">
            <ScrollText className="size-5 text-muted-foreground" aria-hidden />
            <span>{t("dashboard.latestScript.title")}</span>
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
                  <p className="text-sm text-gray-600 line-clamp-5 mb-4">
                    {ultimoGuion.contenido || "—"}
                  </p>
                </div>
                <Button
                  onClick={() => router.push("/dashboard/script")}
                  className="w-full"
                  variant="outline"
                >
                  {t("dashboard.latestScript.viewAll")}
                </Button>
              </>
            ) : (
              <div className="text-center py-8 space-y-2">
                <p className="text-sm text-gray-500">
                  📄 {t("dashboard.latestScript.emptyTitle")}
                </p>
                <p className="text-xs text-gray-400">
                  {t("dashboard.latestScript.emptySubtitle")}
                </p>
                <Button
                  onClick={() => router.push("/dashboard/script")}
                  className="w-full"
                  variant="outline"
                >
                  {t("dashboard.latestScript.view")}
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Último Video */}
        <Card className="p-3 lg:p-4">
          <h2 className="font-semibold text-base lg:text-lg mb-3 flex items-center gap-2">
            <Clapperboard
              className="size-5 text-muted-foreground"
              aria-hidden
            />
            <span>{t("dashboard.latestVideo.title")}</span>
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
                      <video
                        controls
                        src={ultimoVideo.url}
                        preload="metadata"
                        className="rounded max-h-64 w-full object-cover"
                      />
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => router.push("/dashboard/edit")}
                  className="w-full"
                  variant="outline"
                >
                  {t("dashboard.latestVideo.viewAll")}
                </Button>
              </>
            ) : (
              <div className="text-center py-8 space-y-2">
                <p className="text-sm text-gray-500">
                  🎥 {t("dashboard.latestVideo.emptyTitle")}
                </p>
                <p className="text-xs text-gray-400">
                  {t("dashboard.latestVideo.emptySubtitle")}
                </p>
                <Button
                  onClick={() => router.push("/dashboard/videos")}
                  className="w-full"
                  variant="outline"
                >
                  {t("dashboard.latestVideo.view")}
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

