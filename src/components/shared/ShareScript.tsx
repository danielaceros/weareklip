"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { Link as LinkIcon, Check, X } from "lucide-react";

/** Construye la URL pública */
const buildUrl = (sid: string) =>
  (typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "") + `/share/script/${sid}`;

type Props = {
  scriptId: string;
  isPublic?: boolean;
  shareId?: string | null;
  uid?: string;
  className?: string;
  /** Si "compact", usa botones pequeños para ocupar poco espacio */
  variant?: "default" | "compact";
};

export default function ShareScript({
  scriptId,
  isPublic,
  shareId,
  uid,
  className,
  variant = "default",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [pub, setPub] = useState(!!isPublic);
  const [sid, setSid] = useState<string | null>(shareId || null);
  const [open, setOpen] = useState(false);

  const ensureUid = () => uid || auth.currentUser?.uid || "";

  const activate = async () => {
    const u = auth.currentUser;
    if (!u) return toast.error("No autenticado");
    const owner = ensureUid();
    if (!owner) return toast.error("Falta UID de propietario");
    setBusy(true);
    try {
      const t = await u.getIdToken();
      const res = await fetch(
        `/api/firebase/users/${owner}/scripts/${scriptId}/share`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${t}`,
          },
          body: JSON.stringify({}),
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
    const u = auth.currentUser;
    if (!u) return toast.error("No autenticado");
    const owner = ensureUid();
    if (!owner) return toast.error("Falta UID de propietario");
    setBusy(true);
    try {
      const t = await u.getIdToken();
      const res = await fetch(
        `/api/firebase/users/${owner}/scripts/${scriptId}/share`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${t}` },
        }
      );
      if (!res.ok) throw new Error(await res.text());
      setPub(false);
      toast.success("Enlace desactivado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo desactivar el enlace");
    } finally {
      setBusy(false);
    }
  };

  const url = sid ? buildUrl(sid) : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    } catch {
      toast.message(url);
    }
  };

  // ---- Render compacto ----
  if (variant === "compact") {
    return (
      <>
        {!pub ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={activate}
            disabled={busy}
            className={className}
          >
            <LinkIcon className="mr-1.5 h-4 w-4" />
            Compartir
          </Button>
        ) : (
          <div className={`flex items-center gap-1 ${className || ""}`}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setOpen(true)}
              disabled={!sid || busy}
              className="h-8"
            >
              <Check className="mr-1.5 h-4 w-4" />
              Enlace
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={deactivate}
              disabled={busy}
              className="h-8 w-8"
              title="Desactivar enlace"
            >
              <X className="h-4 w-4" />
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

  // ---- Render por defecto (como lo tenías) ----
  return (
    <>
      {!pub ? (
        <Button onClick={activate} disabled={busy} className={className}>
          <LinkIcon className="mr-2 h-4 w-4" /> Compartir por enlace
        </Button>
      ) : (
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
