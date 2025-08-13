"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import clsx from "clsx";
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
    <section className="border border-border rounded-lg p-6 bg-card text-card-foreground shadow-sm">
      <h2 className="text-xl font-semibold mb-4">
        {t("profile.sectionTitle")}
      </h2>

      <div className="flex items-center gap-6 mb-6">
        <div
          className={clsx(
            "relative w-28 h-28 rounded-full overflow-hidden border cursor-pointer select-none",
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
              style={{ objectFit: "cover" }}
              sizes="112px"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full bg-muted text-muted-foreground text-4xl font-bold">
              {name ? name[0].toUpperCase() : "?"}
            </div>
          )}
        </div>

        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handlePhotoChange}
          disabled={uploadingPhoto}
        />

        <div className="flex-1 space-y-4">
          <div>
            <Label htmlFor="name">{t("profile.labels.name")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName?.(e.target.value)}
              placeholder={t("profile.placeholders.name")}
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
            />
          </div>

          <div>
            <Label htmlFor="phone">{t("profile.labels.phone")}</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone?.(e.target.value)}
              placeholder={t("profile.placeholders.phone")}
            />
          </div>

          <div>
            <Label>{t("profile.labels.emailReadonly")}</Label>
            <Input value={userData?.email ?? ""} disabled />
          </div>

          <Button onClick={saveUserData} disabled={uploadingPhoto}>
            {uploadingPhoto
              ? t("profile.actions.savingPhoto")
              : t("profile.actions.save")}
          </Button>
        </div>
      </div>
    </section>
  );
}
