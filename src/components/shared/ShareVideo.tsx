"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { Link as LinkIcon, Check, X } from "lucide-react";

type Kind = "videos" | "lipsync";
type Variant = "full" | "chip";

const buildUrl = (kind: Kind, sid: string) =>
  (typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "") +
  (kind === "videos" ? `/share/video/${sid}` : `/share/lipsync/${sid}`);

type Props = {
  docId: string;
  kind?: Kind; // "videos" | "lipsync" (por defecto "videos")
  uid?: string; // opcional
  isPublic?: boolean; // estado inicial
  shareId?: string | null;
  variant?: Variant; // "chip" muestra ✓ Enlace + X; "full" muestra los dos botones grandes
  className?: string;
};

export default function ShareVideo({
  docId,
  kind = "videos",
  uid,
  isPublic,
  shareId,
  variant = "full",
  className,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [pub, setPub] = useState(!!isPublic);
  const [sid, setSid] = useState<string | null>(shareId || null);
  const [open, setOpen] = useState(false);

  const owner = uid || auth.currentUser?.uid || "";

  const activate = async () => {
    if (!owner) return toast.error("No autenticado");
    setBusy(true);
    try {
      const t = await auth.currentUser!.getIdToken();
      const res = await fetch(
        `/api/firebase/users/${owner}/${kind}/${docId}/share`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${t}`,
          },
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSid(data.uid_share);
      setPub(true);
      setOpen(true);
      toast.success("Enlace público activado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo activar el enlace");
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    if (!owner) return toast.error("No autenticado");
    setBusy(true);
    try {
      const t = await auth.currentUser!.getIdToken();
      const res = await fetch(
        `/api/firebase/users/${owner}/${kind}/${docId}/share`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${t}` },
        }
      );
      if (!res.ok) throw new Error(await res.text());
      setPub(false);
      setSid(null);
      toast.success("Enlace desactivado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo desactivar el enlace");
    } finally {
      setBusy(false);
    }
  };

  const url = sid ? buildUrl(kind, sid) : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    } catch {
      toast.message(url);
    }
  };

  return (
    <>
      {!pub ? (
        <Button
          onClick={activate}
          disabled={busy}
          className={className}
          size={variant === "chip" ? "sm" : "default"}
          variant={variant === "chip" ? "secondary" : "default"}
        >
          <LinkIcon className="mr-2 h-4 w-4" /> Compartir
        </Button>
      ) : variant === "chip" ? (
        // 👇 CHIP: ✓ Enlace + X (icon-only)
        <div className={`flex items-center gap-2 ${className || ""}`}>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setOpen(true)}
            disabled={!sid || busy}
            className="h-8 rounded-lg"
          >
            <Check className="mr-2 h-4 w-4" /> Enlace
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={deactivate}
            disabled={busy}
            className="h-8 w-8 rounded-full"
            aria-label="Desactivar enlace público"
            title="Desactivar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        // 👇 FULL: Enlace generado + Desactivar (el diseño antiguo)
        <div className={`flex items-center gap-2 ${className || ""}`}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(true)}
            disabled={!sid || busy}
          >
            <Check className="mr-2 h-4 w-4" /> Enlace generado
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={deactivate}
            disabled={busy}
          >
            <X className="mr-1 h-4 w-4" /> Desactivar
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-neutral-950 text-white border border-neutral-800">
          <DialogHeader>
            <DialogTitle>Enlace para compartir</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Input
              readOnly
              value={url}
              className="bg-neutral-900 border-neutral-800"
            />
            <p className="text-xs text-neutral-400">
              Solo lectura. Puedes desactivarlo cuando quieras.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={copy}>Copiar enlace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
