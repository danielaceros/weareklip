// src/app/dashboard/edit/DeleteVideoDialog.tsx
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
import { useTranslations } from "next-intl"; // ⬅️ i18n

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
  const t = useTranslations("deleteVideoDialog");

  const handleDelete = async () => {
    if (!video) return;
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      toast.error(t("errors.signInRequired"));
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

      toast.success(t("toasts.deleted"));
      onDeleted?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(t("errors.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t("actions.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? t("actions.deleting") : t("actions.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
