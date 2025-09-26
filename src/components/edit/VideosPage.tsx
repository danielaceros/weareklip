"use client";

import { useEffect, useState } from "react";
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

// 👇 abrir el modal con ?new=1 y limpiar la URL
import { useSearchParams, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";

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
  const t = useT();

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
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    const fetchVideos = async () => {
      if (!user) return;
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
        toast.error(t("edit.page.toasts.loadError"));
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [user, t]);

  // Auto-abrir modal si venimos con ?new=1 y limpiar la URL
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowCreateModal(true);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("new");
        router.replace(url.pathname + (url.search ? url.search : ""), {
          scroll: false,
        });
      }
    }
  }, [searchParams, router]);

  async function handleConfirmDelete() {
    if (!user) return;
    setDeleting(true);

    const prevVideos = [...videos];

    try {
      const idToken = await user.getIdToken();

      if (deleteAll) {
        // Optimistic: vaciamos lista al instante
        setVideos([]);

        const res = await fetch(`/api/firebase/users/${user.uid}/videos`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ all: true }),
        });

        if (!res.ok) throw new Error("Error eliminando todos los vídeos");

        toast.success(t("edit.page.toasts.deleteAllSuccess"));
      } else if (videoToDelete) {
        // Optimistic: quitamos de la lista antes del DELETE real
        setVideos((prev) =>
          prev.filter((v) => v.projectId !== videoToDelete.projectId)
        );

        const res = await fetch(
          `/api/firebase/users/${user.uid}/videos/${videoToDelete.projectId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${idToken}` },
          }
        );

        if (!res.ok) throw new Error("Error eliminando vídeo");

        toast.success(t("edit.page.toasts.deleteOneSuccess"));
      }
    } catch (err) {
      console.error("Error eliminando vídeos:", err);
      toast.error(t("edit.page.toasts.deleteError"));
      setVideos(prevVideos); // rollback
    } finally {
      setDeleting(false);
      setVideoToDelete(null);
      setDeleteAll(false);
    }
  }

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
        <h1 className="text-2xl font-bold">{t("edit.page.title")}</h1>
        <div className="flex gap-3">
          <Button
            variant="destructive"
            className="rounded-lg"
            onClick={() => setDeleteAll(true)}
            disabled={videos.length === 0}
          >
            <Trash2 size={18} className="mr-2" />
            {t("edit.page.actions.deleteAll")}
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"
          >
            <Plus size={18} className="mr-2" />
            {t("edit.page.actions.create")}
          </Button>
        </div>
      </div>

      {/* Lista de vídeos */}
      {videos.length === 0 ? (
        <p>{t("edit.page.empty")}</p>
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
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative bg-background rounded-xl shadow-lg w-full max-w-4xl mx-auto p-6 z-50 overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
              aria-label={t("edit.page.actions.closeModal")}
            >
              <X size={20} />
            </button>
            <CreateVideoPage
              onCreated={(
                video?: VideoData & {
                  _optimistic?: boolean;
                  _rollback?: boolean;
                }
              ) => {
                if (!video) {
                  setShowCreateModal(false);
                  setTimeout(() => window.location.reload(), 300);
                  return;
                }

                if (video._rollback) {
                  setVideos((prev) =>
                    prev.filter((v) => v.projectId !== video.projectId)
                  );
                } else if (video._optimistic) {
                  setVideos((prev) => [...prev, video]);
                } else {
                  setShowCreateModal(false);
                  setTimeout(() => window.location.reload(), 300);
                }
              }}
            />
          </div>
        </div>
      )}

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
            ? t("edit.page.deleteDialog.titleAll")
            : t("edit.page.deleteDialog.titleOne")
        }
        description={
          deleteAll
            ? t("edit.page.deleteDialog.bodyAll")
            : t("edit.page.deleteDialog.bodyOne")
        }
        confirmText={
          deleteAll
            ? t("edit.page.deleteDialog.confirmAll")
            : t("edit.page.deleteDialog.confirmOne")
        }
      />
    </div>
  );
}
