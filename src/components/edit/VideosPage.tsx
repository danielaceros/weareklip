"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import toast from "react-hot-toast";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

import VideoCard from "./VideoCard";
import DeleteVideoDialog from "./DeleteVideoDialog";

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
          snapshot.docs.map(docSnap => ({
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
      // Firestore
      await deleteDoc(doc(db, "users", user.uid, "videos", videoToDelete.projectId));

      // Storage
      if (videoToDelete.storagePath) {
        await deleteObject(ref(storage, videoToDelete.storagePath));
      } else if (videoToDelete.downloadUrl) {
        const url = new URL(videoToDelete.downloadUrl);
        const path = decodeURIComponent(url.pathname.split("/o/")[1] || "").split("?")[0];
        if (path) await deleteObject(ref(storage, path));
      }

      // Actualiza lista
      setVideos(prev => prev.filter(v => v.projectId !== videoToDelete.projectId));
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
    <>
      {/* Botón crear vídeo */}
      <div className="flex justify-end mb-4">
        <Link href="/dashboard/edit/new">
          <Button className="rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition">
            <Plus size={18} className="mr-2" />
            Crear vídeo
          </Button>
        </Link>
      </div>

      {/* Lista de vídeos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
        {videos.length === 0 && <p>No tienes vídeos aún.</p>}
        {videos.map(video => (
          <VideoCard
            key={video.projectId}
            video={video}
            onDelete={() => setVideoToDelete(video)}
          />
        ))}
      </div>

      {/* Modal eliminar */}
      <DeleteVideoDialog
        open={!!videoToDelete}
        onClose={() => setVideoToDelete(null)}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </>
  );
}
