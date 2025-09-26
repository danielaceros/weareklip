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
import { useT } from "@/lib/i18n";

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
  const t = useT();

  const computedTitle = useMemo(
    () => script?.description || script?.videoTitle || t("scriptsDeleteDialog.thisScript"),
    [script?.description, script?.videoTitle, t]
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md animate-in fade-in-0 zoom-in-95">
        <DialogHeader>
          <DialogTitle>{t("scriptsDeleteDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("scriptsDeleteDialog.description", { title: computedTitle })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-3">
          <Button variant="secondary" onClick={onClose}>
            {t("scriptsDeleteDialog.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={deleting}
            aria-label={t("scriptsDeleteDialog.ariaDelete", { title: computedTitle })}
          >
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {deleting ? t("scriptsDeleteDialog.deleting") : t("scriptsDeleteDialog.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
