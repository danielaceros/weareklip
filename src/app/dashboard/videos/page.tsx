"use client";

import type { Video } from "@/types/video";
import { useEffect, useState, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import VideoEditorModal from "@/components/shared/videomodal";
import { handleError, showSuccess, showLoading } from "@/lib/errors";
import { logAction } from "@/lib/logs"; // 🔥 Importar logAction
import toast from "react-hot-toast";

export default function VideosPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Video | null>(null);
  const [tituloEditado, setTituloEditado] = useState("");
  const [estadoEditado, setEstadoEditado] = useState("0");
  const [estadoOriginal, setEstadoOriginal] = useState("0"); // 🔥 Estado original para comparar
  const [notasEditadas, setNotasEditadas] = useState("");
  const [open, setOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const estados: Record<number, React.ReactNode> = {
    0: <Badge className="bg-red-500 text-white">🆕 Nuevo</Badge>,
    1: <Badge className="bg-yellow-400 text-black">✏️ Cambios</Badge>,
    2: <Badge className="bg-green-500 text-white">✅ Aprobado</Badge>,
  };

  const sendNotificationEmail = async (
    subject: string,
    content: string
  ) => {
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

  const fetchVideos = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const ref = collection(db, "users", uid, "videos");
      const snapshot = await getDocs(ref);

      if (snapshot.empty) {
        toast("Aún no tienes vídeos. Cuando estén listos, los verás aquí.");
      }

      const data: Video[] = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          firebaseId: doc.id,
          titulo: d.titulo ?? "Sin título",
          url: d.url ?? "",
          estado: d.estado ?? 0,
          notas: d.notas ?? "",
        };
      });

      setVideos(data);
    } catch (error) {
      console.error("Error obteniendo vídeos:", error);
      handleError(error, "Error al cargar los vídeos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        handleError(null, "Inicia sesión para acceder a tus vídeos.");
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
  }, [fetchVideos]);

  const openModal = (video: Video) => {
    setSelected(video);
    setTituloEditado(video.titulo);
    setEstadoEditado(String(video.estado));
    setEstadoOriginal(String(video.estado)); // 🔥 Guardar estado original
    setNotasEditadas(video.notas ?? "");
    setOpen(true);
  };

  const guardarCambios = async () => {
    if (!userId || !selected || !userEmail) {
      handleError(null, "Falta información del usuario o vídeo.");
      return;
    }

    if (tituloEditado.trim() === "") {
      toast.error("El título no puede estar vacío.");
      return;
    }

    const loadingToast = showLoading("Guardando cambios...");
    try {
      const ref = doc(db, "users", userId, "videos", selected.firebaseId);
      const nuevoEstado = parseInt(estadoEditado);

      await updateDoc(ref, {
        estado: nuevoEstado,
        titulo: tituloEditado.trim(),
        notas: estadoEditado === "1" ? notasEditadas.trim() : "",
      });

      const updatedVideo = {
        ...selected,
        estado: nuevoEstado,
        titulo: tituloEditado.trim(),
        notas: estadoEditado === "1" ? notasEditadas.trim() : "",
      };

      setVideos((prev) =>
        prev.map((v) =>
          v.firebaseId === selected.firebaseId ? updatedVideo : v
        )
      );

      const estadoCambio = estadoOriginal !== estadoEditado;
      if (estadoCambio && auth.currentUser) {
        try {
          let action = "";
          let message = "";
          
          if (nuevoEstado === 1) {
            action = "cambios_solicitados";
            message = `Cliente ${auth.currentUser.email || auth.currentUser.displayName || 'Usuario'} solicitó cambios en video: "${tituloEditado.trim()}"`;
          } else if (nuevoEstado === 2) {
            action = "aprobado";
            message = `Cliente ${auth.currentUser.email || auth.currentUser.displayName || 'Usuario'} aprobó video: "${tituloEditado.trim()}"`;
          }

          if (action && message) {
            await logAction({
              type: "video",
              action,
              uid: auth.currentUser.uid,
              admin: auth.currentUser.email || auth.currentUser.displayName || "Cliente",
              targetId: selected.firebaseId,
              message
            });
            
            console.log(`✅ Log registrado: ${message}`);
          }
        } catch (logError) {
          console.error("❌ Error al registrar log:", logError);
        }
      }

      showSuccess("Cambios guardados correctamente");

      const estadoTexto =
        nuevoEstado === 0
          ? "🆕 Nuevo"
          : nuevoEstado === 1
          ? "✏️ Cambios solicitados"
          : "✅ Aprobado";

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
            const data = await res.json();
            console.log("✅ Tarea asignada para video:", data);
          }
        } catch (error) {
          console.error("❌ Error al asignar tarea:", error);
        }
      }

      setOpen(false);
    } catch (error) {
      console.error("Error guardando cambios:", error);
      handleError(error, "No se pudo actualizar el vídeo");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleDeleteConfirmado = async () => {
    if (!userId || !userEmail || !videoToDelete) return;

    setIsDeleting(true);
    const loadingToast = showLoading("Eliminando video...");

    try {
      await deleteDoc(doc(db, "users", userId, "videos", videoToDelete.firebaseId));
      
      setVideos(prev => prev.filter(v => v.firebaseId !== videoToDelete.firebaseId));
      
      setOpen(false);
      setSelected(null);
      
      showSuccess(" Video eliminado permanentemente");
      
      await sendNotificationEmail(
        `🗑️ Video eliminado por ${userEmail}`,
        `El cliente ha eliminado el video titulado: "${videoToDelete.titulo}".`
      );
    } catch (error) {
      console.error("Error al eliminar video:", error);
      handleError(error, "❌ Error al eliminar el video");
    } finally {
      setIsDeleting(false);
      toast.dismiss(loadingToast);
      setVideoToDelete(null);
    }
  };

  const handleDownload = async () => {
    if (!selected) return;
    const loadingToast = showLoading("Preparando descarga...");
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
      handleError(error, "No se pudo descargar el vídeo");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">🎬 Mis Vídeos</h1>

      {loading ? (
        <p className="text-muted-foreground animate-pulse">Cargando vídeos...</p>
      ) : videos.length === 0 ? (
        <p className="text-muted-foreground">No hay vídeos disponibles.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((v) => (
            <Card
              key={v.firebaseId}
              className="p-3 cursor-pointer"
              onClick={() => openModal(v)}
              tabIndex={0}
              role="button"
              aria-label={`Seleccionar video ${v.titulo}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") openModal(v);
              }}
            >
              <div className="flex justify-between items-center mb-2">
                <p className="font-semibold text-base truncate">{v.titulo}</p>
                {v.estado !== undefined ? (
                  estados[v.estado] ?? (
                    <Badge variant="secondary">Desconocido</Badge>
                  )
                ) : null}
              </div>
              <video
                controls
                src={v.url}
                className="rounded w-full aspect-[9/16] object-cover"
                preload="metadata"
                aria-label={`Video: ${v.titulo}`}
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
        />
      )}

      {videoToDelete && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-lg font-semibold mb-4">¿Eliminar video?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              ¿Estás seguro de que deseas eliminar el video <strong>{videoToDelete.titulo}</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setVideoToDelete(null)}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteConfirmado}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Eliminando...
                  </span>
                ) : "Eliminar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}