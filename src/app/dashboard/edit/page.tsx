"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import toast from "react-hot-toast";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";

interface VideoData {
  projectId: string;
  title: string;
  status: string;
  downloadUrl?: string;
  storagePath?: string; // ruta en Storage para borrar
  duration?: number;
  completedAt?: string;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Modal
  const [videoToDelete, setVideoToDelete] = useState<VideoData | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Obtener usuario loggeado
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Cargar vídeos
  useEffect(() => {
    const fetchVideos = async () => {
      if (!user) return;

      try {
        const videosRef = collection(db, "users", user.uid, "videos");
        const snapshot = await getDocs(videosRef);

        const data: VideoData[] = snapshot.docs.map(docSnap => ({
          projectId: docSnap.id,
          ...(docSnap.data() as Omit<VideoData, "projectId">),
        }));
        setVideos(data);
      } catch (error) {
        console.error("Error fetching videos:", error);
        toast.error("Error cargando vídeos");
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [user]);

  // Eliminar vídeo
  const handleDelete = async () => {
    if (!user || !videoToDelete) return;
    setDeleting(true);

    try {
      // 1. Borrar documento de Firestore
      await deleteDoc(doc(db, "users", user.uid, "videos", videoToDelete.projectId));

      // 2. Borrar archivo de Storage (si hay ruta conocida)
      if (videoToDelete.storagePath) {
        await deleteObject(ref(storage, videoToDelete.storagePath));
      } else if (videoToDelete.downloadUrl) {
        // Si no hay storagePath, intentar inferirlo
        const url = new URL(videoToDelete.downloadUrl);
        const path = decodeURIComponent(url.pathname.split("/o/")[1] || "").split("?")[0];
        if (path) {
          await deleteObject(ref(storage, path));
        }
      }

      // 3. Actualizar estado local
      setVideos((prev) => prev.filter(v => v.projectId !== videoToDelete.projectId));
      toast.success("Vídeo eliminado correctamente");
    } catch (error) {
      console.error("Error eliminando vídeo:", error);
      toast.error("No se pudo eliminar el vídeo");
    } finally {
      setDeleting(false);
      setVideoToDelete(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500 hover:bg-green-600">Completado</Badge>;
      case "processing":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Procesando</Badge>;
      case "error":
        return <Badge className="bg-red-500 hover:bg-red-600">Error</Badge>;
      default:
        return <Badge className="bg-gray-500">Desconocido</Badge>;
    }
  };

  if (loading) return <p>Cargando vídeos...</p>;

  return (
    <>
      {/* Botón crear vídeo arriba derecha */}
      <div className="flex justify-end mb-4">
        <Link href="/dashboard/edit/new">
          <Button className="rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition">
            <Plus size={18} className="mr-2" />
            Crear vídeo
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
        {videos.length === 0 && <p>No tienes vídeos aún.</p>}

        {videos.map(video => (
          <Card key={video.projectId} className="overflow-hidden">
            <CardHeader className="p-3 flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold truncate">{video.title || "Sin título"}</h3>
                <div>{getStatusBadge(video.status)}</div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setVideoToDelete(video)}
              >
                <Trash2 size={16} className="text-red-500" />
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              {video.downloadUrl && video.status === "completed" ? (
                <video
                  controls
                  src={video.downloadUrl}
                  className="w-full aspect-[9/16] object-cover"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-xs p-4">
                  En proceso...
                </div>
              )}
            </CardContent>

            <CardFooter className="p-3 flex justify-between items-center">
              {video.downloadUrl && (
                <Button size="sm" variant="secondary" asChild>
                  <a
                    href={video.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Descargar
                  </a>
                </Button>
              )}
              {video.duration && (
                <span className="text-xs text-gray-500">⏱ {video.duration}s</span>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Modal de confirmación */}
      <Dialog open={!!videoToDelete} onOpenChange={() => setVideoToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar vídeo</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar este vídeo? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setVideoToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
