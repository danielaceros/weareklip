"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { db, storage } from "@/lib/firebase";
import { doc, deleteDoc } from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { toast } from "sonner";
import { useState } from "react";

interface VideoData {
  projectId: string;
  storagePath?: string;
  downloadUrl?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  video?: VideoData | null;
  onDeleted?: () => void; // callback para refrescar lista
}

export default function DeleteVideoDialog({
  open,
  onClose,
  video,
  onDeleted,
}: Props) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!video) return;
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      toast.error("Debes iniciar sesión para eliminar vídeos");
      return;
    }

    setDeleting(true);
    try {
      const idToken = await user.getIdToken();

      const res = await fetch(
        `/api/firebase/users/${user.uid}/videos/${video.projectId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      toast.success("✅ Vídeo eliminado correctamente");
      onDeleted?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("❌ No se pudo eliminar el vídeo");
    } finally {
      setDeleting(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar vídeo</DialogTitle>
          <DialogDescription>
            ¿Seguro que quieres eliminar este vídeo? Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

