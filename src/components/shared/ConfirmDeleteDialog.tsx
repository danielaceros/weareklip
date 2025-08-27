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

interface ConfirmDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;

  /** Título del modal */
  title?: string;

  /** Mensaje de confirmación */
  description?: string;

  /** Texto del botón cancelar */
  cancelText?: string;

  /** Texto del botón eliminar */
  confirmText?: string;
}

export default function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
  deleting,
  title = "Eliminar elemento",
  description = "¿Seguro que quieres eliminar este elemento? Esta acción no se puede deshacer.",
  cancelText = "Cancelar",
  confirmText = "Eliminar",
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Eliminando..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
