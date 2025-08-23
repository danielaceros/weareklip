"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import clsx from "clsx";
import { Save } from "lucide-react";
import { ChangeEvent, RefObject } from "react";

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
  fileInputRef?: RefObject<HTMLInputElement>;
  handlePhotoClick?: () => void;
  handlePhotoChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  photoURL?: string | null;
  saveUserData?: () => void;
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
  return (
    <Card className="p-6 bg-card text-card-foreground shadow-sm space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t("profile.sectionTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("profile.sectionSubtitle")}
        </p>
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
            <Image
              src={photoURL}
              alt="Profile photo"
              fill
              className="object-cover"
              sizes="112px"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full bg-muted text-muted-foreground text-4xl font-bold">
              {name ? name[0].toUpperCase() : "?"}
            </div>
          )}

          {/* Overlay al pasar el ratón */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-sm">
            {t("profile.actions.changePhoto")}
          </div>
        </div>

        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handlePhotoChange}
          disabled={uploadingPhoto}
        />

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
            <Label htmlFor="instagramUser">
              {t("profile.labels.instagramUser")}
            </Label>
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

          <Button
            onClick={saveUserData}
            disabled={uploadingPhoto}
            className="mt-4 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {uploadingPhoto
              ? t("profile.actions.savingPhoto")
              : t("profile.actions.save")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
