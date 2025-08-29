"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { LipsyncVideoList } from "./LipsyncVideoList";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import LipsyncCreatePage from "./LipsyncCreatePage";
import { toast } from "sonner";
import { getStorage, ref, deleteObject } from "firebase/storage";
import ConfirmDeleteDialog from "@/components/shared/ConfirmDeleteDialog";

interface VideoData {
  projectId: string;
  title: string;
  status: string;
  downloadUrl?: string;
  duration?: number;
}

export default function LipsyncVideosPage() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);

  // Estado para eliminar
  const [videoToDelete, setVideoToDelete] = useState<VideoData | null>(null);
  const [deleteAll, setDeleteAll] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchVideos = async () => {
      if (!user) return;
      try {
        const videosRef = collection(db, "users", user.uid, "lipsync");
        const snapshot = await getDocs(videosRef);
        const data: VideoData[] = snapshot.docs.map((docSnap) => ({
          projectId: docSnap.id,
          ...(docSnap.data() as Omit<VideoData, "projectId">),
        }));
        setVideos(data);
      } catch (error) {
        console.error("Error fetching lipsync videos:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
  }, [user]);

  async function handleConfirmDelete() {
    if (!user) return;
    setDeleting(true);

    try {
      if (deleteAll) {
        // Borrar todos
        await Promise.all(
          videos.map(async (video) => {
            await deleteDoc(doc(db, "users", user.uid, "lipsync", video.projectId));
            if (video.downloadUrl && video.downloadUrl.includes("firebasestorage")) {
              try {
                const storage = getStorage();
                const path = decodeURIComponent(
                  new URL(video.downloadUrl).pathname.split("/o/")[1].split("?")[0]
                );
                await deleteObject(ref(storage, path));
              } catch {}
            }
          })
        );
        setVideos([]);
        toast.success("Todos los vídeos han sido eliminados");
      } else if (videoToDelete) {
        // Borrar uno
        await deleteDoc(doc(db, "users", user.uid, "lipsync", videoToDelete.projectId));
        if (
          videoToDelete.downloadUrl &&
          videoToDelete.downloadUrl.includes("firebasestorage")
        ) {
          try {
            const storage = getStorage();
            const path = decodeURIComponent(
              new URL(videoToDelete.downloadUrl).pathname.split("/o/")[1].split("?")[0]
            );
            await deleteObject(ref(storage, path));
          } catch {}
        }
        setVideos((prev) => prev.filter((v) => v.projectId !== videoToDelete.projectId));
        toast.success("Vídeo eliminado correctamente");
      }
    } catch (err) {
      console.error("Error eliminando vídeos:", err);
      toast.error("No se pudieron eliminar los vídeos");
    } finally {
      setDeleting(false);
      setVideoToDelete(null);
      setDeleteAll(false);
    }
  }

  if (loading) return <p>Cargando vídeos...</p>;

  return (
    <div className="space-y-6">
      {/* Header con título y botones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Clones</h1>
        <div className="flex gap-3">
          <div className="flex gap-3 justify-end">
          <Button
            variant="destructive"
            className="rounded-lg"
            onClick={() => setDeleteAll(true)}
            disabled={videos.length === 0}
          >
            <Trash2 size={18} className="mr-2" />
            Borrar todos
          </Button>

          <Button
            className="rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"
            onClick={() => setIsNewOpen(true)}
          >
            <Plus size={18} className="mr-2" />
            Crear vídeo
          </Button>
          </div>
        </div>
      </div>

      {/* Lista de vídeos */}
      <LipsyncVideoList
        videos={videos}
        onDelete={(id, url) =>
          setVideoToDelete({
            projectId: id,
            title: "",
            status: "processing",
            downloadUrl: url,
          })
        }
        perPage={3}
      />

      {/* Modal crear */}
      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogOverlay className="backdrop-blur-sm fixed inset-0" />
        <DialogContent className="max-w-3xl w-full rounded-xl p-0 overflow-hidden">
          <LipsyncCreatePage onClose={() => setIsNewOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Modal eliminar */}
      <ConfirmDeleteDialog
        open={!!videoToDelete || deleteAll}
        onClose={() => {
          setVideoToDelete(null);
          setDeleteAll(false);
        }}
        onConfirm={handleConfirmDelete}
        deleting={deleting}
        title={deleteAll ? "Eliminar todos los vídeos" : "Eliminar vídeo Lipsync"}
        description={
          deleteAll
            ? "¿Seguro que quieres eliminar TODOS los vídeos? Esta acción no se puede deshacer."
            : "¿Seguro que quieres eliminar este vídeo? Esta acción no se puede deshacer."
        }
        confirmText={deleteAll ? "Eliminar todos" : "Eliminar"}
      />
    </div>
  );
}
