"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { getStorage, ref, deleteObject } from "firebase/storage";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { AudiosList, AudioData } from "./AudiosList";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from "@/components/ui/dialog";
import AudioCreatorContainer from "./AudioCreatorContainer";
import ConfirmDeleteDialog from "@/components/shared/ConfirmDeleteDialog";
import { toast } from "sonner";

export default function AudiosContainer() {
  const [audios, setAudios] = useState<AudioData[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);

  // estado para eliminar
  const [audioToDelete, setAudioToDelete] = useState<AudioData | null>(null);
  const [deleteAll, setDeleteAll] = useState(false);
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
      toast.error("Error cargando audios");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAudios();
  }, [fetchAudios]);

  const handleConfirmDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      if (deleteAll) {
        // borrar todos
        await Promise.all(
          audios.map(async (audio) => {
            await deleteDoc(doc(db, "users", user.uid, "audios", audio.audioId));
            if (audio.url && audio.url.includes("firebasestorage")) {
              try {
                const storage = getStorage();
                const path = decodeURIComponent(
                  new URL(audio.url).pathname.split("/o/")[1].split("?")[0]
                );
                await deleteObject(ref(storage, path));
              } catch {}
            }
          })
        );
        setAudios([]);
        toast.success("Todos los audios eliminados");
      } else if (audioToDelete) {
        // borrar uno
        await deleteDoc(doc(db, "users", user.uid, "audios", audioToDelete.audioId));
        if (audioToDelete.url && audioToDelete.url.includes("firebasestorage")) {
          try {
            const storage = getStorage();
            const path = decodeURIComponent(
              new URL(audioToDelete.url).pathname.split("/o/")[1].split("?")[0]
            );
            await deleteObject(ref(storage, path));
          } catch {}
        }
        setAudios((prev) => prev.filter((a) => a.audioId !== audioToDelete.audioId));
        toast.success("Audio eliminado");
      }
    } catch (err) {
      console.error("Error eliminando audio:", err);
      toast.error("No se pudo eliminar el audio");
    } finally {
      setDeleting(false);
      setAudioToDelete(null);
      setDeleteAll(false);
    }
  };

  if (loading) return <p>Cargando audios...</p>;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <h1 className="text-2xl font-bold">Mis Audios</h1>
      <div className="flex justify-between">
          <Button
            variant="destructive"
            className="rounded-lg"
            onClick={() => setDeleteAll(true)}
            disabled={audios.length === 0}
          >
            <Trash2 size={18} className="mr-2" />
            Borrar todos
          </Button>
          <Button
            onClick={() => setIsNewOpen(true)}
            className="rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"
          >
            <Plus size={18} className="mr-2" />
            Nuevo audio
          </Button>
      </div>

      {/* Lista de audios */}
      <AudiosList audios={audios} onDelete={(audio) => setAudioToDelete(audio)} />

      {/* Modal crear audio */}
      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogOverlay className="backdrop-blur-sm fixed inset-0" />
        <DialogContent className="max-w-3xl w-full rounded-xl">
          <AudioCreatorContainer />
        </DialogContent>
      </Dialog>

      {/* Modal eliminar */}
      <ConfirmDeleteDialog
        open={!!audioToDelete || deleteAll}
        onClose={() => {
          setAudioToDelete(null);
          setDeleteAll(false);
        }}
        onConfirm={handleConfirmDelete}
        deleting={deleting}
        title={deleteAll ? "Eliminar todos los audios" : "Eliminar audio"}
        description={
          deleteAll
            ? "¿Seguro que quieres eliminar TODOS los audios? Esta acción no se puede deshacer."
            : "¿Seguro que quieres eliminar este audio? Esta acción no se puede deshacer."
        }
        confirmText={deleteAll ? "Eliminar todos" : "Eliminar"}
      />
    </div>
  );
}
