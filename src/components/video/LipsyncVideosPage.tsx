"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { LipsyncVideoList } from "./LipsyncVideoList";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import LipsyncCreatePage from "./LipsyncCreatePage";
import { toast } from "sonner";
import { getStorage, ref, deleteObject } from "firebase/storage";
import DeleteLipsyncDialog from "./DeleteLipsyncDialog";

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
    if (!user || !videoToDelete) return;
    setDeleting(true);
    try {
      // 1) Eliminar documento Firestore
      await deleteDoc(doc(db, "users", user.uid, "lipsync", videoToDelete.projectId));

      // 2) Eliminar archivo en Storage si es nuestro bucket
      if (videoToDelete.downloadUrl && videoToDelete.downloadUrl.includes("firebasestorage")) {
        const storage = getStorage();
        try {
          const path = decodeURIComponent(
            new URL(videoToDelete.downloadUrl).pathname.split("/o/")[1].split("?")[0]
          );
          await deleteObject(ref(storage, path));
          toast.success("Vídeo y archivo eliminados correctamente");
        } catch (err) {
          console.warn("No se pudo eliminar de Storage:", err);
          toast.success("Vídeo eliminado (archivo no encontrado en Storage)");
        }
      } else {
        toast.success("Vídeo eliminado correctamente");
      }

      setVideos((prev) =>
        prev.filter((v) => v.projectId !== videoToDelete.projectId)
      );
    } catch (err) {
      console.error("Error eliminando vídeo:", err);
      toast.error("No se pudo eliminar el vídeo");
    } finally {
      setDeleting(false);
      setVideoToDelete(null);
    }
  }

  if (loading) return <p>Cargando vídeos...</p>;

  return (
    <div className="space-y-4">
      {/* Botón Crear */}
      <div className="flex justify-end">
        <Button
          className="rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"
          onClick={() => setIsNewOpen(true)}
        >
          <Plus size={18} className="mr-2" />
          Crear vídeo
        </Button>
      </div>

      {/* Lista de vídeos */}
      <LipsyncVideoList
        videos={videos}
        onDelete={(id, url) =>
          setVideoToDelete({ projectId: id, title: "", status: "processing", downloadUrl: url })
        }
      />

      {/* Modal crear */}
      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogOverlay className="backdrop-blur-sm fixed inset-0" />
        <DialogContent className="max-w-3xl w-full rounded-xl p-0 overflow-hidden">
          <LipsyncCreatePage />
        </DialogContent>
      </Dialog>

      {/* Modal eliminar */}
      <DeleteLipsyncDialog
        open={!!videoToDelete}
        onClose={() => setVideoToDelete(null)}
        onConfirm={handleConfirmDelete}
        deleting={deleting}
      />
    </div>
  );
}
