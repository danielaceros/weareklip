"use client";

import { useState, useRef, ChangeEvent } from "react";
import { useUserPanel } from "./useUserPanel";
import UserProfileSection from "./UserProfileSection";
import SubscriptionSection from "./SubscriptionSection";
import ClonacionVideosSection from "./ClonacionVideosSection";
import { Card } from "@/components/ui/card";

export default function UserPanel() {
  const userPanel = useUserPanel();

  // Estado local de datos básicos del usuario
  const [name, setName] = useState("");
  const [instagramUser, setInstagramUser] = useState("");
  const [phone, setPhone] = useState("");
  const [userData] = useState<{ email?: string } | null>(null);

  // Manejo de foto de perfil
  const fileInputRef = useRef<HTMLInputElement>(null!);
  const handleInstagramUserChange = (e: ChangeEvent<HTMLInputElement>) =>
    setInstagramUser(e.target.value);
  const handlePhotoClick = () => fileInputRef.current?.click();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-10">
      {/* Encabezado */}
      <header className="text-center space-y-2">
        <h1 className="text-3xl font-bold">{userPanel.t("title")}</h1>
        <p className="text-muted-foreground text-sm">
          {userPanel.t("subtitle")}
        </p>
      </header>

      {/* Perfil */}
      <section aria-label={userPanel.t("profile.sectionTitle")}>
        <UserProfileSection
          t={userPanel.t}
          name={name}
          setName={setName}
          instagramUser={instagramUser}
          handleInstagramUserChange={handleInstagramUserChange}
          phone={phone}
          setPhone={setPhone}
          userData={userData}
          uploadingPhoto={false}
          fileInputRef={fileInputRef}
          handlePhotoClick={handlePhotoClick}
          handlePhotoChange={() => {}}
          photoURL={null}
          saveUserData={() => {}}
        />
      </section>

      {/* Suscripción */}
      <section aria-label={userPanel.t("subscription.sectionTitle")}>
        <SubscriptionSection
          t={userPanel.t}
          loadingSub={userPanel.loadingSub}
          sub={userPanel.sub}
        />
      </section>

      {/* Clonación de videos */}
      <section aria-label={userPanel.t("clonacion.sectionTitle")}>
        <ClonacionVideosSection
          t={userPanel.t}
          clonacionVideos={userPanel.clonacionVideos}
          handleUpload={userPanel.handleUpload}
          handleDelete={(id) => {
            const video = userPanel.clonacionVideos.find((v) => v.id === id);
            return userPanel.handleDelete(
              id,
              (video as any)?.storagePath ?? ""
            );
          }}
          uploading={userPanel.uploading}
          progress={userPanel.progress}
        />
      </section>
    </div>
  );
}

