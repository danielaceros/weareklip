"use client";

import { useMemo } from "react";
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

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
  script: { description?: string; videoTitle?: string } | null;
}

export default function DeleteScriptDialog({
  open,
  onClose,
  onConfirm,
  deleting,
  script,
}: Props) {
  // 🔹 Memorizar para evitar renders innecesarios
  const title = useMemo(
    () => script?.description || script?.videoTitle || "este guion",
    [script?.description, script?.videoTitle]
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md animate-in fade-in-0 zoom-in-95">
        <DialogHeader>
          <DialogTitle>Eliminar guion</DialogTitle>
          <DialogDescription>
            ¿Seguro que quieres eliminar{" "}
            <strong className="text-foreground">{title}</strong>? <br />
            Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={deleting}
            aria-label={`Eliminar ${title}`}
          >
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {deleting ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

