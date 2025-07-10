"use client";
import type { Video } from "@/types/video";
import { useEffect, useState, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import VideoCard from "@/components/shared/videocard";
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

      const subject = `Vídeo modificado por ${userEmail}`;
      const content = `
        El usuario con email <strong>${userEmail}</strong> ha modificado el vídeo:
        <ul>
          <li><strong>ID:</strong> ${selected.firebaseId}</li>
          <li><strong>Título nuevo:</strong> ${tituloEditado.trim()}</li>
          <li><strong>Estado nuevo:</strong> ${nuevoEstado}</li>
          <li><strong>Notas:</strong> ${notasEditadas.trim() || "Sin notas"}</li>
        </ul>
      `;

      await sendNotificationEmail("rubengomezklip@gmail.com", subject, content);

      toast.success("Cambios guardados correctamente");
      setOpen(false);
    } catch (error) {
      console.error("Error guardando cambios:", error);
      toast.error("No se pudo actualizar el vídeo");
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
      <h1 className="text-2xl font-bold mb-6">Mis Vídeos</h1>

      {loading ? (
        <p className="text-muted-foreground animate-pulse">Cargando vídeos...</p>
      ) : videos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {videos.map((video) => (
            <VideoCard
              key={video.firebaseId}
              titulo={video.titulo}
              url={video.url}
              estado={video.estado}
              correcciones={video.notas}
              onClick={() => openModal(video)}
            />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No hay vídeos disponibles.</p>
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
        />
      )}
    </div>
  );
}
