"use client";

import { useState, useRef, ChangeEvent } from "react";
import { useUserPanel } from "./useUserPanel";
import UserProfileSection from "./UserProfileSection";
import SubscriptionSection from "./SubscriptionSection";
import ClonacionVideosSection from "./ClonacionVideosSection";

export default function UserPanel() {
  const userPanel = useUserPanel();

  // Props para UserProfileSection que no vienen de useUserPanel
  const [name, setName] = useState("");
  const [instagramUser, setInstagramUser] = useState("");
  const handleInstagramUserChange = (e: ChangeEvent<HTMLInputElement>) =>
    setInstagramUser(e.target.value);
  const [phone, setPhone] = useState("");
  const [userData] = useState<{ email?: string } | null>(null); // No usamos setUserData
  const [uploadingPhoto] = useState(false); // No usamos setUploadingPhoto
  const fileInputRef = useRef<HTMLInputElement>(null!);
  const handlePhotoClick = () => fileInputRef.current?.click();
  const handlePhotoChange = () => {}; // No usamos 'e'
  const [photoURL] = useState<string | null>(null); // No usamos setPhotoURL
  const saveUserData = () => {};

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold mb-6">{userPanel.t("title")}</h1>

      <UserProfileSection
        t={userPanel.t}
        name={name}
        setName={setName}
        instagramUser={instagramUser}
        handleInstagramUserChange={handleInstagramUserChange}
        phone={phone}
        setPhone={setPhone}
        userData={userData}
        uploadingPhoto={uploadingPhoto}
        fileInputRef={fileInputRef}
        handlePhotoClick={handlePhotoClick}
        handlePhotoChange={handlePhotoChange}
        photoURL={photoURL}
        saveUserData={saveUserData}
      />

      <SubscriptionSection
        t={userPanel.t}
        loadingSub={userPanel.loadingSub}
        sub={userPanel.sub}
        renderStatusLabel={userPanel.renderStatusLabel}
      />

      <ClonacionVideosSection
        t={userPanel.t}
        clonacionVideos={userPanel.clonacionVideos}
        handleUpload={userPanel.handleUpload}
        handleDelete={userPanel.handleDelete}
        uploading={userPanel.uploading}
        progress={userPanel.progress}
      />
    </div>
  );
}
