"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { storage } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { LipsyncVideoList } from "./LipsyncVideoList";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import LipsyncCreatePage from "./LipsyncCreatePage";
import { toast } from "sonner";
import { ref, deleteObject } from "firebase/storage";
import ConfirmDeleteDialog from "@/components/shared/ConfirmDeleteDialog";
import { Spinner } from "@/components/ui/shadcn-io/spinner"; // 👈 Spinner de shadcn

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
      setLoading(true);
      try {
        const idToken = await user.getIdToken();
        const res = await fetch(`/api/firebase/users/${user.uid}/lipsync`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (!res.ok) throw new Error("Error cargando lipsync");

        const data = await res.json();

        const mapped: VideoData[] = data.map((d: any) => ({
          projectId: d.id,
          ...(d as Omit<VideoData, "projectId">),
        }));

        setVideos(mapped);
      } catch (error) {
        console.error("Error fetching lipsync videos:", error);
        toast.error("❌ No se pudieron cargar los vídeos");
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
      const token = await user.getIdToken();

      if (deleteAll) {
        // 🟥 Borrar todos via API
        await Promise.all(
          videos.map(async (video) => {
            const res = await fetch(
              `/api/firebase/users/${user.uid}/lipsync/${video.projectId}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            if (!res.ok) throw new Error(`Error borrando doc ${video.projectId}`);

            // Borrar en Storage si aplica
            if (video.downloadUrl?.includes("firebasestorage")) {
              try {
                const path = decodeURIComponent(
                  new URL(video.downloadUrl).pathname.split("/o/")[1]?.split("?")[0] ?? ""
                );
                if (path) await deleteObject(ref(storage, path));
              } catch (err) {
                console.warn("⚠️ Error borrando archivo en Storage:", err);
              }
            }
          })
        );

        setVideos([]);
        toast.success("Todos los vídeos han sido eliminados ✅");
      } else if (videoToDelete) {
        const res = await fetch(
          `/api/firebase/users/${user.uid}/lipsync/${videoToDelete.projectId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) throw new Error(`Error borrando doc ${videoToDelete.projectId}`);

        if (videoToDelete.downloadUrl?.includes("firebasestorage")) {
          try {
            const path = decodeURIComponent(
              new URL(videoToDelete.downloadUrl).pathname.split("/o/")[1]?.split("?")[0] ?? ""
            );
            if (path) await deleteObject(ref(storage, path));
          } catch (err) {
            console.warn("⚠️ Error borrando archivo en Storage:", err);
          }
        }

        setVideos((prev) => prev.filter((v) => v.projectId !== videoToDelete.projectId));
        toast.success("Vídeo eliminado correctamente ✅");
      }
    } catch (err) {
      console.error("❌ Error eliminando vídeos:", err);
      toast.error("No se pudieron eliminar los vídeos");
    } finally {
      setDeleting(false);
      setVideoToDelete(null);
      setDeleteAll(false);
    }
  }

  // ✅ Spinner loader
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] w-full">
        <Spinner className="h-12 w-12 text-primary" variant="ellipsis"/>
      </div>
    );
  }

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
          <LipsyncCreatePage
            onClose={() => setIsNewOpen(false)}
            onCreated={() => {
              setTimeout(() => {
                window.location.reload(); // 👈 recarga igual que en scripts/audios
              }, 300);
            }}
          />
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
