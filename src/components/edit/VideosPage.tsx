"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

import VideoCard from "./VideoCard";
import DeleteVideoDialog from "./DeleteVideoDialog";
import CreateVideoPage from "./CreateVideoPage"; // 👈 importar el formulario

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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
  const [deleting, setDeleting] = useState(false);

  // estado para el modal de creación
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

  // Borrado de vídeo
  const handleDelete = async () => {
    if (!user || !videoToDelete) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "users", user.uid, "videos", videoToDelete.projectId));

      if (videoToDelete.storagePath) {
        await deleteObject(ref(storage, videoToDelete.storagePath));
      } else if (videoToDelete.downloadUrl) {
        const url = new URL(videoToDelete.downloadUrl);
        const path = decodeURIComponent(url.pathname.split("/o/")[1] || "").split("?")[0];
        if (path) await deleteObject(ref(storage, path));
      }

      setVideos((prev) => prev.filter((v) => v.projectId !== videoToDelete.projectId));
      toast.success("Vídeo eliminado correctamente");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo eliminar el vídeo");
    } finally {
      setDeleting(false);
      setVideoToDelete(null);
    }
  };

  if (loading) return <p>Cargando vídeos...</p>;

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Botón crear vídeo */}
      <div className="flex justify-end">
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

      {/* Modal eliminar */}
      <DeleteVideoDialog
        open={!!videoToDelete}
        onClose={() => setVideoToDelete(null)}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}
