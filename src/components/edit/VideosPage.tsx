"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, X } from "lucide-react";

import VideoCard from "./VideoCard";
import CreateVideoPage from "./CreateVideoPage";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import ConfirmDeleteDialog from "@/components/shared/ConfirmDeleteDialog";
import { Spinner } from "@/components/ui/shadcn-io/spinner";

import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { useSearchParams, usePathname, useRouter } from "next/navigation";

export interface VideoData {
  projectId: string;
  title: string;
  status: string;
  downloadUrl?: string;
  storagePath?: string;
  duration?: number;
  completedAt?: string;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const [videoToDelete, setVideoToDelete] = useState<VideoData | null>(null);
  const [deleteAll, setDeleteAll] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [page, setPage] = useState(1);
  const perPage = 5;
  const totalPages = Math.ceil(videos.length / perPage);
  const paginated = videos.slice((page - 1) * perPage, page * perPage);

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Auth
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Fetch videos
  const fetchVideos = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/firebase/users/${user.uid}/videos`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();

      setVideos(
        data.map(
          (v: any) =>
            ({
              projectId: v.id,
              ...v,
            } as VideoData)
        )
      );
    } catch (error) {
      console.error("Error cargando vídeos:", error);
      toast.error("Error cargando vídeos");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchVideos();
  }, [fetchVideos]);

  // Abrir modal automáticamente con ?new=1
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowCreateModal(true);
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, pathname, router]);

  // Borrado
  async function handleConfirmDelete() {
    if (!user) return;
    setDeleting(true);

    try {
      const idToken = await user.getIdToken();

      if (deleteAll) {
        const res = await fetch(`/api/firebase/users/${user.uid}/videos`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ all: true }),
        });

        if (!res.ok) throw new Error("Error eliminando todos los vídeos");
        setVideos([]);
        toast.success("Todos los vídeos han sido eliminados");
      } else if (videoToDelete) {
        const res = await fetch(
          `/api/firebase/users/${user.uid}/videos/${videoToDelete.projectId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${idToken}` },
          }
        );
        if (!res.ok) throw new Error("Error eliminando vídeo");

        setVideos((prev) =>
          prev.filter((v) => v.projectId !== videoToDelete.projectId)
        );
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

  // Cierre y refresh desde el hijo
  const handleCreated = useCallback(() => {
    setShowCreateModal(false);
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
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Ediciones</h1>
        <div className="flex gap-3">
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
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"
          >
            <Plus size={18} className="mr-2" />
            Crear vídeo
          </Button>
        </div>
      </div>

      {/* Lista de vídeos */}
      {videos.length === 0 ? (
        <p>No tienes vídeos aún.</p>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
            {paginated.map((video) => (
              <VideoCard
                key={video.projectId}
                video={video}
                onDelete={() => setVideoToDelete(video)}
              />
            ))}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="mt-auto">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page > 1) setPage(page - 1);
                      }}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink
                        href="#"
                        isActive={page === i + 1}
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(i + 1);
                        }}
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page < totalPages) setPage(page + 1);
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}

      {/* Modal crear vídeo */}
      <Dialog
        open={showCreateModal}
        onOpenChange={(open) => {
          setShowCreateModal(open);
          if (!open) void fetchVideos();
        }}
      >
        <DialogOverlay className="backdrop-blur-sm fixed inset-0" />
        <DialogContent
          className="max-w-4xl w-[95vw] md:w-[80vw] p-0"
          // 👇 Altura y scroll FORZADOS dentro del modal
          style={{
            height: "92dvh", // mejor en móviles
            maxHeight: "92vh", // fallback desktop
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div className="relative h-full">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-3 top-3 z-10 text-muted-foreground hover:text-foreground"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>

            {/* 👇 El contenido ocupa todo y scrollea */}
            <div className="h-full overflow-y-auto overscroll-contain">
              <div className="p-6 pb-8">
                <CreateVideoPage onCreated={handleCreated} />
              </div>
            </div>
          </div>
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
        title={deleteAll ? "Eliminar todos los vídeos" : "Eliminar vídeo"}
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
