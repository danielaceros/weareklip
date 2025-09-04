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
import { Loader2 } from "lucide-react";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  // 🔹 onConfirm devuelve un Promise para manejar éxito/error
  onConfirm: () => Promise<void>;
  deleting: boolean;
  title?: string;
  description?: string;
  cancelText?: string;
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
  const handleConfirm = async () => {
    try {
      // 🔹 Cerramos el modal optimistamente
      onClose();
      await onConfirm();
    } catch (err) {
      // ❌ Si falla, lo puedes manejar fuera (ej. reintegrar item en lista con toast)
      console.error("Error al eliminar:", err);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            {cancelText}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleting}
            aria-label={confirmText}
          >
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {deleting ? "Eliminando..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
