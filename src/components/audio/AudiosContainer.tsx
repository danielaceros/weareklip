"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { getStorage, ref, deleteObject } from "firebase/storage";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { AudiosList, AudioData } from "./AudiosList";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from "@/components/ui/dialog";
import AudioCreatorContainer from "./AudioCreatorContainer";
import DeleteAudioDialog from "./DeleteAudioDialog";
import { toast } from "sonner";

export default function AudiosContainer() {
  const [audios, setAudios] = useState<AudioData[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);

  // estado para modal eliminar
  const [audioToDelete, setAudioToDelete] = useState<AudioData | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
  }, []);

  const fetchAudios = useCallback(async () => {
    if (!user) return;
    try {
      const audiosRef = collection(db, "users", user.uid, "audios");
      const snapshot = await getDocs(audiosRef);
      const data: AudioData[] = snapshot.docs.map((docSnap) => {
        const docData = docSnap.data() as Partial<AudioData> & { audioUrl?: string };
        return {
          audioId: docSnap.id,
          url: docData.audioUrl ?? "",
          name: docData.name ?? "",
          description: docData.description ?? "",
          createdAt: docData.createdAt,
          duration: docData.duration,
          language: docData.language,
        };
      });
      setAudios(data);
    } catch (error) {
      console.error("Error fetching audios:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAudios();
  }, [fetchAudios]);

  const handleConfirmDelete = async () => {
    if (!user || !audioToDelete) return;
    setDeleting(true);
    try {
      // 1) Firestore
      await deleteDoc(doc(db, "users", user.uid, "audios", audioToDelete.audioId));

      // 2) Storage
      if (audioToDelete.url && audioToDelete.url.includes("firebasestorage")) {
        try {
          const storage = getStorage();
          const path = decodeURIComponent(
            new URL(audioToDelete.url).pathname.split("/o/")[1].split("?")[0]
          );
          await deleteObject(ref(storage, path));
          toast.success("Audio y archivo eliminados correctamente");
        } catch (err) {
          console.warn("No se pudo eliminar archivo en Storage:", err);
          toast.success("Audio eliminado (archivo no encontrado en Storage)");
        }
      } else {
        toast.success("Audio eliminado correctamente");
      }

      // actualizar estado
      setAudios((prev) => prev.filter((a) => a.audioId !== audioToDelete.audioId));
    } catch (err) {
      console.error("Error eliminando audio:", err);
      toast.error("No se pudo eliminar el audio");
    } finally {
      setDeleting(false);
      setAudioToDelete(null);
    }
  };

  if (loading) return <p>Cargando audios...</p>;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Mis audios</h1>
        <Button
          onClick={() => setIsNewOpen(true)}
          className="rounded-lg"
        >
          + Nuevo audio
        </Button>
      </div>

      {/* Lista de audios */}
      <AudiosList
        audios={audios}
        onDelete={(audio) => setAudioToDelete(audio)}
      />

      {/* Modal crear audio */}
      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogOverlay className="backdrop-blur-sm fixed inset-0" />
        <DialogContent className="max-w-3xl w-full rounded-xl">
          <AudioCreatorContainer />
        </DialogContent>
      </Dialog>

      {/* Modal eliminar */}
      <DeleteAudioDialog
        open={!!audioToDelete}
        onClose={() => setAudioToDelete(null)}
        onConfirm={handleConfirmDelete}
        deleting={deleting}
      />
    </div>
  );
}
