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
import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
  title?: string;
  description?: string;
}

export default function DeleteAudioDialog({
  open,
  onClose,
  onConfirm,
  deleting,
  title = "Eliminar audio",
  description = "¿Estás seguro de que quieres eliminar este audio? Esta acción no se puede deshacer.",
}: Props) {
  // 🔑 Escape = cancelar | Enter = confirmar
  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") onConfirm();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, onConfirm]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent aria-busy={deleting}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={deleting}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

