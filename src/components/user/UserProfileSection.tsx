"use client";

import { useEffect, useRef, useState, ChangeEvent, RefObject } from "react";
import Image from "next/image";
import clsx from "clsx";
import { Save, CheckCircle2 } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

export interface UserProfileSectionProps {
  t: (key: string, values?: Record<string, string | number>) => string;
  name?: string;
  setName?: (value: string) => void;
  instagramUser?: string;
  handleInstagramUserChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  phone?: string;
  setPhone?: (value: string) => void;
  userData?: { email?: string } | null;
  uploadingPhoto?: boolean;
  // 👇 ajuste de tipo: ref nullable
  fileInputRef?: RefObject<HTMLInputElement | null>;
  handlePhotoClick?: () => void;
  handlePhotoChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  photoURL?: string | null;
  saveUserData?: () => void | Promise<void>;
}

export default function UserProfileSection({
  t,
  name = "",
  setName,
  instagramUser = "",
  handleInstagramUserChange,
  phone = "",
  setPhone,
  userData,
  uploadingPhoto = false,
  fileInputRef,
  handlePhotoClick,
  handlePhotoChange,
  photoURL,
  saveUserData,
}: UserProfileSectionProps) {
  // ---------- Confirmación al guardar ----------
  const [justSaved, setJustSaved] = useState(false);
  const onSave = async () => {
    try {
      await Promise.resolve(saveUserData?.());
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch {
      // si falla, no mostramos "guardado"
    }
  };

  // ---------- Recorte básico ----------
  const [cropOpen, setCropOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [rawImg, setRawImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // input oculto para enviar el archivo recortado a tu handler existente
  const hiddenCroppedInputRef = useRef<HTMLInputElement | null>(null);

  // Intercepta la selección de archivo: abrimos cropper
  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setCropOpen(true);
    e.target.value = "";
  };

  useEffect(() => {
    return () => {
      if (imgSrc) URL.revokeObjectURL(imgSrc);
    };
  }, [imgSrc]);

  const onImgLoaded = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setRawImg(e.currentTarget);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    setDragging(false);
    dragStart.current = null;
  };

  // Genera el recorte (512x512) y lo envía a tu handlePhotoChange
  const doCropAndUpload = async () => {
    if (!rawImg || !containerRef.current) return;

    const S = 512;
    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, S, S);

    const W = rawImg.naturalWidth;
    const H = rawImg.naturalHeight;
    const scaleBase = Math.max(S / W, S / H);
    const displayScale = scaleBase * zoom;

    const cx = S / 2;
    const cy = S / 2;

    const sx = (0 - (cx + offset.x)) / displayScale + W / 2;
    const sy = (0 - (cy + offset.y)) / displayScale + H / 2;
    const sw = S / displayScale;
    const sh = S / displayScale;

    ctx.drawImage(rawImg, sx, sy, sw, sh, 0, 0, S, S);

    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.9)
    );

    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });

    if (!hiddenCroppedInputRef.current) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    hiddenCroppedInputRef.current.files = dt.files;

    const evt = { target: hiddenCroppedInputRef.current } as unknown as ChangeEvent<HTMLInputElement>;
    handlePhotoChange?.(evt);

    setCropOpen(false);
  };

  return (
    <Card className="p-6 bg-card text-card-foreground shadow-sm space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t("profile.sectionTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("profile.sectionSubtitle")}</p>
      </div>

      <Separator />

      <div className="flex items-center gap-6">
        {/* Avatar */}
        <div
          className={clsx(
            "relative w-28 h-28 rounded-full overflow-hidden border cursor-pointer group",
            uploadingPhoto ? "opacity-60" : "opacity-100",
            "border-border"
          )}
          onClick={handlePhotoClick}
        >
          {photoURL ? (
            <Image src={photoURL} alt="Profile photo" fill className="object-cover" sizes="112px" />
          ) : (
            <div className="flex items-center justify-center w-full h-full bg-muted text-muted-foreground text-4xl font-bold">
              {name ? name[0].toUpperCase() : "?"}
            </div>
          )}

          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-sm">
            {t("profile.actions.changePhoto")}
          </div>
        </div>

        {/* input real (abre cropper al seleccionar) */}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={onPickFile}
          disabled={uploadingPhoto}
        />

        {/* input oculto para subir el recorte a tu handler existente */}
        <input type="file" className="hidden" ref={hiddenCroppedInputRef} />

        {/* Formulario */}
        <div className="flex-1 space-y-4">
          <div>
            <Label htmlFor="name">{t("profile.labels.name")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName?.(e.target.value)}
              placeholder={t("profile.placeholders.name")}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="instagramUser">{t("profile.labels.instagramUser")}</Label>
            <Input
              id="instagramUser"
              value={instagramUser}
              onChange={handleInstagramUserChange}
              placeholder={t("profile.placeholders.instagramUser")}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="phone">{t("profile.labels.phone")}</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone?.(e.target.value)}
              placeholder={t("profile.placeholders.phone")}
              className="mt-1"
            />
          </div>

          <div>
            <Label>{t("profile.labels.emailReadonly")}</Label>
            <Input value={userData?.email ?? ""} disabled className="mt-1" />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={onSave} disabled={uploadingPhoto} className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              {uploadingPhoto ? t("profile.actions.savingPhoto") : t("profile.actions.save")}
            </Button>

            {justSaved && (
              <span className="inline-flex items-center gap-1 text-sm text-green-500">
                <CheckCircle2 className="w-4 h-4" />
                {t("profile.actions.saved") || "Guardado"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ----- Modal de Recorte ----- */}
      <Dialog open={cropOpen} onOpenChange={setCropOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t("profile.crop.title") || "Recortar foto"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div
              ref={containerRef}
              className="relative mx-auto rounded-lg overflow-hidden bg-muted"
              style={{ width: 320, height: 320 }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {imgSrc && (
                <img
                  src={imgSrc}
                  alt="To crop"
                  onLoad={onImgLoaded}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                    transformOrigin: "center center",
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                  draggable={false}
                />
              )}
              <div className="absolute inset-0 ring-2 ring-white/70 pointer-events-none" />
            </div>

            <div className="px-1">
              <Label className="text-xs text-muted-foreground">
                {t("profile.crop.zoom") || "Zoom"}
              </Label>
              <Slider className="mt-2" min={0.5} max={2} step={0.01} value={[zoom]} onValueChange={(v) => setZoom(v[0] ?? 1)} />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCropOpen(false)} disabled={uploadingPhoto}>
              {t("common.cancel") || "Cancelar"}
            </Button>
            <Button onClick={doCropAndUpload} disabled={uploadingPhoto}>
              {t("profile.crop.confirm") || "Recortar y subir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
