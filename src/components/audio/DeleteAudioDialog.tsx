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
import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";

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
  title,
  description,
}: Props) {
  const t = useTranslations();

  // Textos por defecto desde i18n, permitiendo override vía props
  const titleText = useMemo(
    () => title ?? t("audiosPage.deleteDialog.titleOne"),
    [title, t]
  );
  const descText = useMemo(
    () => description ?? t("audiosPage.deleteDialog.descOne"),
    [description, t]
  );
  const confirmText = t("audiosPage.deleteDialog.confirmOne");
  const cancelText = t("common.cancel");
  const deletingText = t("common.deleting");

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
          <DialogTitle>{titleText}</DialogTitle>
          <DialogDescription>{descText}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={deleting}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? deletingText : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
