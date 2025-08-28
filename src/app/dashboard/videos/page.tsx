"use client";

import type { Video, ReelEstado } from "@/types/video";
import type { ReactNode } from "react";
import { useEffect, useState, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import VideoEditorModal from "@/components/shared/VideoModal";
import { handleError, showSuccess, showLoading } from "@/lib/errors";
import { logAction } from "@/lib/logs";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import { ProgressReel } from "@/components/shared/ProgressReel";

/* ---- helpers de tipado para reelEstado ---- */
const ALLOWED_REEL_ESTADOS: readonly ReelEstado[] = [
  "Recibido",
  "Guión aprobado",
  "Voz generada",
  "Vídeo creado",
  "Entregado",
] as const;

function isReelEstado(v: unknown): v is ReelEstado {
  return typeof v === "string" && (ALLOWED_REEL_ESTADOS as readonly string[]).includes(v);
}
function normalizeReelEstado(v: unknown): ReelEstado {
  return isReelEstado(v) ? v : "Recibido";
}

export default function VideosPage() {
  const t = useTranslations("videosPage");

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Video | null>(null);
  const [tituloEditado, setTituloEditado] = useState("");
  const [estadoEditado, setEstadoEditado] = useState("0");
  const [estadoOriginal, setEstadoOriginal] = useState("0");
  const [notasEditadas, setNotasEditadas] = useState("");
  const [open, setOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const estados: Record<number, ReactNode> = {
    0: <Badge className="bg-red-500 text-white">{t("state.new")}</Badge>,
    1: <Badge className="bg-yellow-400 text-black">{t("state.changes")}</Badge>,
    2: <Badge className="bg-green-500 text-white">{t("state.approved")}</Badge>,
  };

  const sendNotificationEmail = async (subject: string, content: string) => {
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "rubengomezklip@gmail.com",
          subject,
          content,
        }),
      });
    } catch (err) {
      console.error("Error enviando notificación:", err);
    }
  };

  const fetchVideos = useCallback(
    async (uid: string) => {
      setLoading(true);
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("Not authenticated");

        const res = await fetch(`/api/firebase/users/${uid}/videos`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Error ${res.status}`);
        }

        const docs: any[] = await res.json();

        if (!docs.length) {
          toast(t("toast.noVideosYet"));
        }

        const data: Video[] = docs.map((d) => {
          const v = d as Record<string, unknown>;
          const estadoNum =
            typeof v.estado === "number"
              ? (v.estado as number)
              : parseInt((v.estado as string) ?? "0", 10) || 0;

          return {
            firebaseId: d.id,
            titulo: (v.titulo as string) ?? t("untitled"),
            url: (v.url as string) ?? "",
            estado: estadoNum,
            notas: (v.notas as string) ?? "",
            reelEstado: normalizeReelEstado(v.reelEstado),
          };
        });

        setVideos(data);
      } catch (error) {
        console.error("Error obteniendo vídeos:", error);
        handleError(error, t("errors.loadVideos"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        handleError(null, t("errors.mustLogin"));
        setUserId(null);
        setUserEmail(null);
        setVideos([]);
        setLoading(false);
        return;
      }

      setUserId(user.uid);
      setUserEmail(user.email ?? null);
      await fetchVideos(user.uid);
    });

    return () => unsubscribe();
  }, [fetchVideos, t]);

  const openModal = (video: Video) => {
    setSelected(video);
    setTituloEditado(video.titulo);
    setEstadoEditado(String(video.estado));
    setEstadoOriginal(String(video.estado));
    setNotasEditadas(video.notas ?? "");
    setOpen(true);
  };

  const guardarCambios = async () => {
    if (!userId || !selected || !userEmail) {
      handleError(null, t("errors.missingUserOrVideo"));
      return;
    }

    if (tituloEditado.trim() === "") {
      toast.error(t("errors.titleEmpty"));
      return;
    }

    const loadingToast = showLoading(t("loading.saving"));
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const nuevoEstado = parseInt(estadoEditado);

      // 🔹 Llamada a la API (PUT)
      const res = await fetch(
        `/api/firebase/users/${userId}/videos/${selected.firebaseId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            estado: nuevoEstado,
            titulo: tituloEditado.trim(),
            notas: estadoEditado === "1" ? notasEditadas.trim() : "",
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      const updatedVideo = (await res.json()) as Video;

      // 🔹 Actualizar estado local
      setVideos((prev) =>
        prev.map((v) => (v.firebaseId === selected.firebaseId ? updatedVideo : v))
      );

      // 🔹 Log si cambia estado
      const estadoCambio = estadoOriginal !== estadoEditado;
      if (estadoCambio && auth.currentUser) {
        try {
          let action = "";
          let message = "";

          if (nuevoEstado === 1) {
            action = "cambios_solicitados";
            message = `Cliente ${
              auth.currentUser.email || auth.currentUser.displayName || "Usuario"
            } solicitó cambios en video: "${tituloEditado.trim()}"`;
          } else if (nuevoEstado === 2) {
            action = "aprobado";
            message = `Cliente ${
              auth.currentUser.email || auth.currentUser.displayName || "Usuario"
            } aprobó video: "${tituloEditado.trim()}"`;
          }

          if (action && message) {
            await logAction(auth.currentUser, {
              type: "video",
              action,
              uid: auth.currentUser.uid,
              admin:
                auth.currentUser.email || auth.currentUser.displayName || "Cliente",
              targetId: selected.firebaseId,
              message,
            });
          }
        } catch (logError) {
          console.error("❌ Error al registrar log:", logError);
        }
      }

      showSuccess(t("toast.saved"));

      const estadoTexto =
        nuevoEstado === 0
          ? t("state.new")
          : nuevoEstado === 1
          ? t("state.changes")
          : t("state.approved");

      await sendNotificationEmail(
        `🎬 Video actualizado por ${userEmail}`,
        `Se ha actualizado el video "${tituloEditado.trim()}".\n\nEstado: ${estadoTexto}\nNotas: ${updatedVideo.notas || "Sin notas"}`
      );

      if (nuevoEstado === 1) {
        try {
          const res = await fetch("/api/assign-task", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: `📽️ Revisar cambios solicitados en video: ${tituloEditado.trim()}`,
            }),
          });

          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Error ${res.status}: ${errorText}`);
          }

          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            await res.json();
          }
        } catch (error) {
          console.error("❌ Error al asignar tarea:", error);
        }
      }

      setOpen(false);
    } catch (error) {
      console.error("Error guardando cambios:", error);
      handleError(error, t("errors.updateVideo"));
    } finally {
      toast.dismiss(loadingToast);
    }
  };


  const handleDeleteConfirmado = async () => {
    if (!userId || !userEmail || !videoToDelete) return;

    setIsDeleting(true);
    const loadingToast = showLoading(t("loading.deleting"));

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      // 🔹 Llamada DELETE a la API
      const res = await fetch(
        `/api/firebase/users/${userId}/videos/${videoToDelete.firebaseId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      // 🔹 Actualizar lista local
      setVideos((prev) =>
        prev.filter((v) => v.firebaseId !== videoToDelete.firebaseId)
      );

      setOpen(false);
      setSelected(null);

      showSuccess(t("toast.deleted"));

      // 🔹 Notificación
      await sendNotificationEmail(
        `🗑️ Video eliminado por ${userEmail}`,
        `El cliente ha eliminado el video titulado: "${videoToDelete.titulo}".`
      );
    } catch (error) {
      console.error("Error al eliminar video:", error);
      handleError(error, t("errors.deleteVideo"));
    } finally {
      setIsDeleting(false);
      toast.dismiss(loadingToast);
      setVideoToDelete(null);
    }
  };


  const handleDownload = async () => {
    if (!selected) return;
    const loadingToast = showLoading(t("download.preparing"));
    try {
      const response = await fetch(
        `/api/download-video?url=${encodeURIComponent(selected.url)}`
      );
      if (!response.ok) throw new Error("Error al descargar");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tituloEditado || selected.titulo}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error descargando vídeo:", error);
      handleError(error, t("errors.downloadVideo"));
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">🎬 {t("title")}</h1>

      {loading ? (
        <p className="text-muted-foreground animate-pulse">{t("loading.loadingVideos")}</p>
      ) : videos.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((v) => (
            <Card
              key={v.firebaseId}
              className="p-3 cursor-pointer"
              onClick={() => openModal(v)}
              tabIndex={0}
              role="button"
              aria-label={t("aria.selectVideo", { title: v.titulo })}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") openModal(v);
              }}
            >
              <div className="flex justify-between items-center mb-2">
                <p className="font-semibold text-base truncate">{v.titulo}</p>
                {v.estado !== undefined ? (
                  estados[v.estado] ?? <Badge variant="secondary">{t("common.unknown")}</Badge>
                ) : null}
              </div>

              {/* Progreso del reel */}
              <ProgressReel estado={v.reelEstado} compact className="mb-2" />

              <video
                controls
                src={v.url}
                className="rounded w-full aspect-[9/16] object-cover"
                preload="metadata"
                aria-label={t("aria.videoLabel", { title: v.titulo })}
              />
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <VideoEditorModal
          open={open}
          onOpenChange={setOpen}
          titulo={tituloEditado}
          url={selected.url}
          estado={estadoEditado}
          notas={notasEditadas}
          onNotasChange={setNotasEditadas}
          onTituloChange={setTituloEditado}
          onEstadoChange={setEstadoEditado}
          onDownload={handleDownload}
          onGuardar={guardarCambios}
          onEliminar={() => {
            setVideoToDelete(selected);
            setOpen(false);
          }}
          videoId={selected.firebaseId}
          estadoAnterior={estadoOriginal}
          /* 👉 ahora el modal recibe el progreso para mostrarlo en lectura */
          reelEstado={selected.reelEstado ?? "Recibido"}
        />
      )}

      {videoToDelete && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-lg font-semibold mb-4">{t("deleteDialog.title")}</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {t("deleteDialog.body", { title: videoToDelete.titulo })}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setVideoToDelete(null)} disabled={isDeleting}>
                {t("actions.cancel")}
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirmado} disabled={isDeleting}>
                {isDeleting ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {t("loading.deleting")}
                  </span>
                ) : (
                  t("actions.delete")
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
