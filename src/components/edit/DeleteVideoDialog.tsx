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
import toast from "react-hot-toast";
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
      // 1. Eliminar doc de Firestore
      await deleteDoc(doc(db, "users", user.uid, "videos", video.projectId));

      // 2. Eliminar archivo de Storage (si existe)
      if (video.storagePath) {
        await deleteObject(ref(storage, video.storagePath));
      } else if (video.downloadUrl) {
        const url = new URL(video.downloadUrl);
        const path = decodeURIComponent(url.pathname.split("/o/")[1] || "").split("?")[0];
        if (path) await deleteObject(ref(storage, path));
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
