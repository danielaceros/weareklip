"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Spinner } from "@/components/ui/shadcn-io/spinner";
import { useT } from "@/lib/i18n";

export interface VideoData {
  projectId: string;
  title: string; // obligatorio
  status: string;
  downloadUrl?: string;
  duration?: number;
}

type OptimisticVideoData = VideoData & { _rollback?: boolean };

export default function LipsyncVideosPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [videos, setVideos] = useState<OptimisticVideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);

  // Estado para eliminar
  const [videoToDelete, setVideoToDelete] = useState<VideoData | null>(null);
  const [deleteAll, setDeleteAll] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Autoabrir modal con ?new=1 y limpiar la URL
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setIsNewOpen(true);
      router.replace("/dashboard/video");
    }
  }, [searchParams, router]);

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
        toast.error(t("lipsyncPage.toasts.loadError"));
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [user, t]);

  async function handleConfirmDelete() {
    if (!user) return;
    setDeleting(true);

    // Guardamos estado previo por si falla
    const prevVideos = [...videos];

    try {
      const token = await user.getIdToken();

      if (deleteAll) {
        // Optimistic: vaciamos lista al instante
        setVideos([]);

        await Promise.all(
          prevVideos.map(async (video) => {
            const res = await fetch(
              `/api/firebase/users/${user.uid}/lipsync/${video.projectId}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            if (!res.ok)
              throw new Error(`Error borrando doc ${video.projectId}`);

            // Borrar archivo en Storage si aplica
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

        toast.success(t("lipsyncPage.toasts.deleteAllSuccess"));
      } else if (videoToDelete) {
        // Optimistic: quitamos de la lista antes del DELETE real
        setVideos((prev) =>
          prev.filter((v) => v.projectId !== videoToDelete.projectId)
        );

        const res = await fetch(
          `/api/firebase/users/${user.uid}/lipsync/${videoToDelete.projectId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
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

        toast.success(t("lipsyncPage.toasts.deleteOneSuccess"));
      }
    } catch (err) {
      console.error("❌ Error eliminando vídeos:", err);
      toast.error(t("lipsyncPage.toasts.deleteError"));

      // Revertimos si falla
      setVideos(prevVideos);
    } finally {
      setDeleting(false);
      setVideoToDelete(null);
      setDeleteAll(false);
    }
  }

  // Loader
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] w-full">
        <Spinner className="h-12 w-12 text-primary" variant="ellipsis" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("lipsyncPage.title")}</h1>
        <div className="flex gap-3">
          <Button
            variant="destructive"
            className="rounded-lg"
            onClick={() => setDeleteAll(true)}
            disabled={videos.length === 0}
          >
            <Trash2 size={18} className="mr-2" />
            {t("lipsyncPage.buttons.deleteAll")}
          </Button>

          <Button
            className="rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"
            onClick={() => setIsNewOpen(true)}
          >
            <Plus size={18} className="mr-2" />
            {t("lipsyncPage.buttons.create")}
          </Button>
        </div>
      </div>

      {/* Lista */}
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
            onCreated={(video?: OptimisticVideoData) => {
              if (!video) return;

              if (video._rollback) {
                setVideos((prev) =>
                  prev.filter((v) => v.projectId !== video.projectId)
                );
              } else {
                setVideos((prev) => [...prev, video]);
              }
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
        title={
          deleteAll
            ? t("lipsyncPage.confirm.deleteAllTitle")
            : t("lipsyncPage.confirm.deleteOneTitle")
        }
        description={
          deleteAll
            ? t("lipsyncPage.confirm.deleteAllDesc")
            : t("lipsyncPage.confirm.deleteOneDesc")
        }
        confirmText={
          deleteAll
            ? t("lipsyncPage.confirm.confirmAll")
            : t("lipsyncPage.confirm.confirmOne")
        }
      />
    </div>
  );
}
