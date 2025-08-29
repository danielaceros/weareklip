"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { AudiosList, AudioData } from "./AudiosList";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import AudioCreatorContainer from "./AudioCreatorContainer";
import ConfirmDeleteDialog from "@/components/shared/ConfirmDeleteDialog";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/shadcn-io/spinner"; // 👈 Spinner de shadcn

export default function AudiosContainer() {
  const [audios, setAudios] = useState<AudioData[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);

  // estado de borrado
  const [audioToDelete, setAudioToDelete] = useState<AudioData | null>(null);
  const [deleteAll, setDeleteAll] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  const fetchAudios = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/firebase/users/${user.uid}/audios`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();

      const mapped: AudioData[] = data.map((d: any) => ({
        audioId: d.id,
        url: d.audioUrl ?? "",
        name: d.name ?? "",
        description: d.description ?? "",
        createdAt: d.createdAt,
        duration: d.duration,
        language: d.language,
      }));

      setAudios(mapped);
    } catch (error) {
      console.error("Error fetching audios:", error);
      toast.error("❌ No se pudieron cargar los audios");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAudios();
  }, [fetchAudios]);

  const handleConfirmDelete = useCallback(async () => {
    if (!user) return;
    if (deleting) return; // prevenir clicks dobles
    setDeleting(true);

    try {
      const idToken = await user.getIdToken();

      if (deleteAll) {
        // borrar todos
        await Promise.all(
          audios.map(async (audio) => {
            const res = await fetch(
              `/api/firebase/users/${user.uid}/audios/${audio.audioId}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${idToken}` },
              }
            );
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || `Error ${res.status}`);
            }
          })
        );
        setAudios([]);
        toast.success("🗑️ Todos los audios eliminados");
      } else if (audioToDelete) {
        // borrar uno
        const res = await fetch(
          `/api/firebase/users/${user.uid}/audios/${audioToDelete.audioId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${idToken}` },
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Error ${res.status}`);
        }

        setAudios((prev) =>
          prev.filter((a) => a.audioId !== audioToDelete.audioId)
        );
        toast.success("Audio eliminado ✅");
      }
    } catch (err) {
      console.error("Error eliminando audio:", err);
      toast.error("❌ No se pudo eliminar el audio");
    } finally {
      setDeleting(false);
      setAudioToDelete(null);
      setDeleteAll(false);
    }
  }, [user, deleteAll, audioToDelete, audios, deleting]);

  const deleteDialogOpen = useMemo(
    () => !!audioToDelete || deleteAll,
    [audioToDelete, deleteAll]
  );

  // ✅ Spinner state (en vez de skeletons)
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] w-full">
        <Spinner className="h-12 w-12 text-primary" variant="ellipsis"/>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <h1 className="text-2xl font-bold">Mis Audios</h1>
      <div className="flex justify-between">
        <Button
          variant="destructive"
          className="rounded-lg"
          onClick={() => setDeleteAll(true)}
          disabled={audios.length === 0 || deleting}
        >
          <Trash2 size={18} className="mr-2" />
          {deleting && deleteAll ? "Eliminando..." : "Borrar todos"}
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
        open={deleteDialogOpen}
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
