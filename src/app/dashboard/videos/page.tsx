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
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import VideoEditorModal from "@/components/shared/videomodal";

export default function VideosPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Video | null>(null);
  const [tituloEditado, setTituloEditado] = useState("");
  const [estadoEditado, setEstadoEditado] = useState("0");
  const [notasEditadas, setNotasEditadas] = useState("");
  const [open, setOpen] = useState(false);

  const estados: Record<number, React.ReactNode> = {
    0: <Badge className="bg-red-500 text-white">🆕 Nuevo</Badge>,
    1: <Badge className="bg-yellow-400 text-black">✏️ Cambios</Badge>,
    2: <Badge className="bg-green-500 text-white">✅ Aprobado</Badge>,
  };

  const sendNotificationEmail = async (
    to: string,
    subject: string,
    content: string
  ) => {
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, content }),
      });
    } catch (err) {
      console.error("Error enviando correo:", err);
    }
  };

  const fetchVideos = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const ref = collection(db, "users", uid, "videos");
      const snapshot = await getDocs(ref);

      if (snapshot.empty) {
        toast("Aún no tienes vídeos", {
          description: "Cuando estén listos, los verás aquí.",
        });
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
      toast.error("Error al cargar los vídeos", {
        description: "Verifica tu conexión o intenta de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        toast.error("No autenticado", {
          description: "Inicia sesión para acceder a tus vídeos.",
        });
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
    setNotasEditadas(video.notas ?? "");
    setOpen(true);
  };

  const guardarCambios = async () => {
    if (!userId || !selected || !userEmail) {
      toast.error("No se puede guardar", {
        description: "Falta información del usuario o vídeo.",
      });
      return;
    }

    if (tituloEditado.trim() === "") {
      toast.warning("El título no puede estar vacío.");
      return;
    }

    try {
      const ref = doc(db, "users", userId, "videos", selected.firebaseId);
      const nuevoEstado = parseInt(estadoEditado);

      await updateDoc(ref, {
        estado: nuevoEstado,
        titulo: tituloEditado.trim(),
        notas: notasEditadas.trim(),
      });

      setVideos((prev) =>
        prev.map((v) =>
          v.firebaseId === selected.firebaseId
            ? {
                ...v,
                estado: nuevoEstado,
                titulo: tituloEditado.trim(),
                notas: notasEditadas.trim(),
              }
            : v
        )
      );

      const subject = `🎬 Vídeo editado por ${userEmail}`;
      const content = `
        El usuario con email <strong>${userEmail}</strong> ha <strong>modificado un vídeo</strong>:
        <ul>
          <li><strong>ID:</strong> ${selected.firebaseId}</li>
          <li><strong>Título nuevo:</strong> ${tituloEditado.trim()}</li>
          <li><strong>Estado nuevo:</strong> ${nuevoEstado}</li>
          <li><strong>Notas:</strong> ${notasEditadas.trim() || "Sin notas"}</li>
        </ul>
      `;

      await sendNotificationEmail("rubengomezklip@gmail.com", subject, content);

      if (nuevoEstado === 1) { 
        try {
          const res = await fetch("/api/assign-task", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: `📽️ Revisar vídeo rechazado por cliente: ${tituloEditado.trim()}`,
            }),
          });

          const data = await res.json();
          console.log("✅ Tarea asignada para video:", data);
        } catch (error) {
          console.error("❌ Error al asignar tarea:", error);
        }
      }

      toast.success("Cambios guardados correctamente");
      setOpen(false);
    } catch (error) {
      console.error("Error guardando cambios:", error);
      toast.error("No se pudo actualizar el vídeo");
    }
  };

  const handleDeleteVideo = async () => {
    if (!userId || !selected || !userEmail) return;

    try {
      const ref = doc(db, "users", userId, "videos", selected.firebaseId);
      await deleteDoc(ref);

      setVideos((prev) =>
        prev.filter((v) => v.firebaseId !== selected.firebaseId)
      );

      const subject = `🗑 Vídeo eliminado por ${userEmail}`;
      const content = `
        El usuario con email <strong>${userEmail}</strong> ha <strong>eliminado un vídeo</strong>:
        <ul>
          <li><strong>ID:</strong> ${selected.firebaseId}</li>
          <li><strong>Título:</strong> ${selected.titulo}</li>
          <li><strong>Estado:</strong> ${selected.estado}</li>
          <li><strong>Notas:</strong> ${selected.notas || "Sin notas"}</li>
        </ul>
      `;

      await sendNotificationEmail("rubengomezklip@gmail.com", subject, content);

      toast.success("Vídeo eliminado correctamente");
      setOpen(false);
    } catch (err) {
      console.error("Error al eliminar vídeo:", err);
      toast.error("No se pudo eliminar el vídeo");
    }
  };

  const handleDownload = async () => {
    if (!selected) return;
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
      toast.error("No se pudo descargar el vídeo");
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
          onEliminar={handleDeleteVideo}
        />
      )}
    </div>
  );
}