"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { storage } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { LipsyncVideoList } from "./LipsyncVideoList";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import LipsyncCreatePage from "./LipsyncCreatePage";
import { toast } from "sonner";
import { ref, deleteObject } from "firebase/storage";
import ConfirmDeleteDialog from "@/components/shared/ConfirmDeleteDialog";
import { Spinner } from "@/components/ui/shadcn-io/spinner";
import { useSearchParams, usePathname, useRouter } from "next/navigation";

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

  const [videoToDelete, setVideoToDelete] = useState<VideoData | null>(null);
  const [deleteAll, setDeleteAll] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  const fetchVideos = useCallback(async () => {
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
  }, [user]);

  useEffect(() => {
    void fetchVideos();
  }, [fetchVideos]);

  // Abrir con ?new=1
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setIsNewOpen(true);
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, pathname, router]);

  async function handleConfirmDelete() {
    if (!user) return;
    setDeleting(true);
    try {
      const token = await user.getIdToken();

      if (deleteAll) {
        await Promise.all(
          videos.map(async (video) => {
            const res = await fetch(
              `/api/firebase/users/${user.uid}/lipsync/${video.projectId}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            if (!res.ok)
              throw new Error(`Error borrando doc ${video.projectId}`);

            if (video.downloadUrl?.includes("firebasestorage")) {
              try {
                const path = decodeURIComponent(
                  new URL(video.downloadUrl).pathname
                    .split("/o/")[1]
                    ?.split("?")[0] ?? ""
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
          { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok)
          throw new Error(`Error borrando doc ${videoToDelete.projectId}`);

        if (videoToDelete.downloadUrl?.includes("firebasestorage")) {
          try {
            const path = decodeURIComponent(
              new URL(videoToDelete.downloadUrl).pathname
                .split("/o/")[1]
                ?.split("?")[0] ?? ""
            );
            if (path) await deleteObject(ref(storage, path));
          } catch (err) {
            console.warn("⚠️ Error borrando archivo en Storage:", err);
          }
        }

        setVideos((prev) =>
          prev.filter((v) => v.projectId !== videoToDelete.projectId)
        );
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

  // 👉 Recibe la señal del hijo: cerrar + refrescar
  const handleCreated = useCallback(() => {
    // 1) cierra el modal (controlado por el padre)
    setIsNewOpen(false);
    // 2) refresca (ligero retraso para evitar carreras con animación del modal)
    setTimeout(() => void fetchVideos(), 50);
  }, [fetchVideos]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] w-full">
        <Spinner className="h-12 w-12 text-primary" variant="ellipsis" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Clones</h1>
        <div className="flex gap-3">
          <Button
            variant="destructive"
            className="rounded-lg"
            onClick={() => setDeleteAll(true)}
            disabled={videos.length === 0 || deleting}
          >
            <Trash2 size={18} className="mr-2" />
            {deleting && deleteAll ? "Eliminando..." : "Borrar todos"}
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
      <Dialog
        open={isNewOpen}
        onOpenChange={(open) => {
          setIsNewOpen(open);
          // si se cierra manualmente, refrescamos
          if (!open) void fetchVideos();
        }}
      >
        <DialogOverlay className="backdrop-blur-sm fixed inset-0" />
        <DialogContent className="max-w-3xl w-full rounded-xl p-0 overflow-hidden">
          <LipsyncCreatePage
            onCreated={handleCreated}
            onCancel={() => setIsNewOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!videoToDelete || deleteAll}
        onClose={() => {
          setVideoToDelete(null);
          setDeleteAll(false);
        }}
        onConfirm={handleConfirmDelete}
        deleting={deleting}
        title={
          deleteAll ? "Eliminar todos los vídeos" : "Eliminar vídeo Lipsync"
        }
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
