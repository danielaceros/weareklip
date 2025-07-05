"use client";

import { useEffect, useState, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download } from "lucide-react";

type Video = {
  firebaseId: string;
  titulo: string;
  url: string;
  estado: number;
};

export default function VideosPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Video | null>(null);
  const [tituloEditado, setTituloEditado] = useState("");
  const [estadoEditado, setEstadoEditado] = useState("0");
  const [open, setOpen] = useState(false);

  // Función para enviar mail de notificación
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
      });

      setVideos((prev) =>
        prev.map((v) =>
          v.firebaseId === selected.firebaseId
            ? { ...v, estado: nuevoEstado, titulo: tituloEditado.trim() }
            : v
        )
      );

      // Enviar correo notificando el cambio
      const subject = `Vídeo modificado por ${userEmail}`;
      const content = `
        El usuario con email <strong>${userEmail}</strong> ha modificado el vídeo:
        <ul>
          <li><strong>ID:</strong> ${selected.firebaseId}</li>
          <li><strong>Título nuevo:</strong> ${tituloEditado.trim()}</li>
          <li><strong>Estado nuevo:</strong> ${nuevoEstado}</li>
        </ul>
      `;

      await sendNotificationEmail("klipprueba@gmail.com", subject, content);

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

  const renderEstado = (estado: number) => {
    switch (estado) {
      case 0:
        return (
          <Badge className="bg-red-500 text-white" aria-label="Estado nuevo">
            🆕 Nuevo
          </Badge>
        );
      case 1:
        return (
          <Badge className="bg-yellow-400 text-black" aria-label="Estado con cambios">
            ✏️ Cambios
          </Badge>
        );
      case 2:
        return (
          <Badge className="bg-green-500 text-white" aria-label="Estado aprobado">
            ✅ Aprobado
          </Badge>
        );
      default:
        return <Badge variant="secondary">Desconocido</Badge>;
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Mis Vídeos</h1>

      {loading ? (
        <p className="text-muted-foreground animate-pulse">Cargando vídeos...</p>
      ) : videos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {videos.map((video) => (
            <Card
              key={video.firebaseId}
              className="cursor-pointer hover:shadow-lg transition"
              onClick={() => openModal(video)}
              tabIndex={0}
              role="button"
              aria-label={`Editar vídeo ${video.titulo}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") openModal(video);
              }}
            >
              <CardContent className="p-2 space-y-1">
                <div className="flex justify-between items-center">
                  <h2 className="font-semibold text-base truncate">{video.titulo}</h2>
                  {renderEstado(video.estado)}
                </div>
                <video
                  src={video.url}
                  className="w-full max-w-[180px] max-h-[320px] rounded object-contain mt-2"
                  controls
                  preload="metadata"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No hay vídeos disponibles.</p>
      )}

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <input
                type="text"
                value={tituloEditado}
                onChange={(e) => setTituloEditado(e.target.value)}
                className="w-110 border-b border-gray-300 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 rounded"
                placeholder="Editar título"
                aria-label="Editar título del vídeo"
              />
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <>
              <video
                src={selected.url}
                controls
                className="w-full max-w-[320px] max-h-[568px] rounded mx-auto object-contain"
                preload="metadata"
                aria-label={`Previsualización del video ${tituloEditado}`}
              />

              <div className="mt-4 flex flex-col sm:flex-row sm:justify-between gap-4 items-center">
                <Button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  aria-label="Descargar vídeo"
                >
                  <Download className="w-5 h-5" />
                </Button>

                <div className="flex items-center gap-2">
                  <Select value={estadoEditado} onValueChange={setEstadoEditado}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Selecciona estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">🆕 Nuevo</SelectItem>
                      <SelectItem value="1">✏️ Cambios</SelectItem>
                      <SelectItem value="2">✅ Aprobado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={guardarCambios}>Guardar cambios</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
