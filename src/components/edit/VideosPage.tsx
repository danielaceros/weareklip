"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import toast from "react-hot-toast";
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

import { getStorage, ref, deleteObject } from "firebase/storage";
import ConfirmDeleteDialog from "@/components/shared/ConfirmDeleteDialog";

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

  // Escucha de usuario autenticado
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return unsubscribe;
  }, []);

  // Carga de vídeos del usuario
  useEffect(() => {
    const fetchVideos = async () => {
      if (!user) return;
      try {
        const videosRef = collection(db, "users", user.uid, "videos");
        const snapshot = await getDocs(videosRef);
        setVideos(
          snapshot.docs.map((docSnap) => ({
            projectId: docSnap.id,
            ...(docSnap.data() as Omit<VideoData, "projectId">),
          }))
        );
      } catch (error) {
        console.error(error);
        toast.error("Error cargando vídeos");
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
        // 🔴 Borrar todos
        await Promise.all(
          videos.map(async (video) => {
            await deleteDoc(doc(db, "users", user.uid, "videos", video.projectId));
            if (video.storagePath) {
              try {
                const storage = getStorage();
                await deleteObject(ref(storage, video.storagePath));
              } catch {}
            }
          })
        );
        setVideos([]);
        toast.success("Todos los vídeos han sido eliminados");
      } else if (videoToDelete) {
        // 🟠 Borrar uno
        await deleteDoc(doc(db, "users", user.uid, "videos", videoToDelete.projectId));
        if (videoToDelete.storagePath) {
          try {
            const storage = getStorage();
            await deleteObject(ref(storage, videoToDelete.storagePath));
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
    <div className="flex flex-col h-full space-y-6">
      <h1 className="text-2xl font-bold">Mis Ediciones</h1>
      <div className="flex justify-between">
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

      {/* Lista de vídeos */}
      {videos.length === 0 ? (
        <p>No tienes vídeos aún.</p>
      ) : (
        <>
          <div
            className="
              grid gap-4
              grid-cols-[repeat(auto-fill,minmax(280px,300px))]
            "
          >
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
          {/* Fondo blur */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          />
          {/* Contenido */}
          <div className="relative bg-background rounded-xl shadow-lg w-full max-w-4xl mx-auto p-6 z-50 overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
            >
              <X size={20} />
            </button>
            <CreateVideoPage />
          </div>
        </div>
      )}

      {/* Modal eliminar (reusable) */}
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
